import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { registeredWorkspaces, workspaceResources } from "./workspace-metadata.mjs";
import {
  bucketOwnership,
  bucketOwnershipLabels,
  bucketOwnershipObjectName,
  withFullSetupLock,
} from "./workspace-full.mjs";
import { teardownWorkspaceLeases } from "./workspace-proxy.mjs";

const JOURNAL_VERSION = 1;
const JOURNAL_DIRECTORY = "lazuli-workspace-orphans";
const POSTGRES_CONTAINER = "lazuli-postgres";

function rootHash(root) {
  return createHash("sha256").update(path.resolve(root)).digest("hex");
}

function commonGitDirectory(root) {
  const value = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return path.resolve(root, value);
}

async function atomicJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, target);
}

async function persistJournal(file, journal) {
  await atomicJson(file, { ...journal, updatedAt: new Date().toISOString() });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function existingJournal(root, directory) {
  const direct = path.join(directory, `${rootHash(root)}.json`);
  try {
    return { file: direct, journal: await readJson(direct) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const name of await readdir(directory).catch((error) =>
    error.code === "ENOENT" ? [] : Promise.reject(error),
  )) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(directory, name);
    const journal = await readJson(file);
    if (journal.technicalPath === path.resolve(root)) return { file, journal };
  }
  return null;
}

function run(command, arguments_, root) {
  return execFileSync(command, arguments_, { cwd: root, encoding: "utf8" }).trim();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expectedOwnership(workspace) {
  return [workspace.ownershipToken, workspace.identity, workspace.initialTechnicalPath].join("|");
}

function databaseOwnership(root, workspace) {
  const sql = `SELECT ownership_token || '|' || workspace_identity || '|' || technical_path FROM lazuli_local.workspace_ownership WHERE singleton = true`;
  return run(
    "docker",
    [
      "exec",
      POSTGRES_CONTAINER,
      "psql",
      "-U",
      "lazuli",
      "-d",
      workspace.resources.database,
      "-tAc",
      sql,
    ],
    root,
  );
}

function databaseExists(root, workspace) {
  return (
    run(
      "docker",
      [
        "exec",
        POSTGRES_CONTAINER,
        "psql",
        "-U",
        "lazuli",
        "-d",
        "postgres",
        "-tAc",
        `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(workspace.resources.database)}`,
      ],
      root,
    ) === "1"
  );
}

function dropDatabase(root, workspace) {
  run(
    "docker",
    [
      "exec",
      POSTGRES_CONTAINER,
      "psql",
      "-U",
      "lazuli",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP DATABASE ${workspace.resources.database} WITH (FORCE)`,
    ],
    root,
  );
}

function bucketMetadata(root, bucket) {
  return JSON.parse(
    run(
      "curl",
      ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`],
      root,
    ),
  );
}

function bucketExists(root, bucket) {
  return (
    run(
      "curl",
      [
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`,
      ],
      root,
    ) === "200"
  );
}

function bucketIsOwned(metadata, workspace) {
  const labels = metadata.labels ?? {};
  return Object.entries(bucketOwnershipLabels(workspace)).every(
    ([name, value]) => labels[name] === value,
  );
}

function bucketOwnershipObject(root, bucket) {
  try {
    return JSON.parse(
      run(
        "curl",
        [
          "-fsS",
          `http://localhost:4443/storage/v1/b/${bucket}/o/${encodeURIComponent(bucketOwnershipObjectName())}?alt=media`,
        ],
        root,
      ),
    );
  } catch {
    return null;
  }
}

function bucketHasOwnershipMarker(root, metadata, workspace) {
  return (
    bucketIsOwned(metadata, workspace) ||
    JSON.stringify(bucketOwnershipObject(root, workspace.resources.bucket)) ===
      JSON.stringify(bucketOwnership(workspace))
  );
}

function deleteBucket(root, bucket) {
  const listing = JSON.parse(
    run(
      "curl",
      ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}/o?project=lazuli-local`],
      root,
    ),
  );
  for (const object of listing.items ?? []) {
    run(
      "curl",
      [
        "-fsS",
        "-X",
        "DELETE",
        `http://localhost:4443/storage/v1/b/${bucket}/o/${encodeURIComponent(object.name)}`,
      ],
      root,
    );
  }
  run("curl", ["-fsS", "-X", "DELETE", `http://localhost:4443/storage/v1/b/${bucket}`], root);
}

async function validateWorkspace(root, workspace) {
  if (path.resolve(root) !== workspace.initialTechnicalPath) {
    throw new TypeError("workspace metadata belongs to a different technical path");
  }
  const expected = workspaceResources(workspace.identity);
  if (
    workspace.resources.database !== expected.database ||
    workspace.resources.bucket !== expected.bucket
  ) {
    throw new TypeError("workspace resource names are inconsistent with its identity");
  }
  if (typeof workspace.ownershipToken !== "string") {
    throw new TypeError("legacy workspace has no ownership token; run setup before teardown");
  }
  const workspaces = await registeredWorkspaces(root);
  const collision = workspaces.find(
    ({ workspace: other }) =>
      other.identity === workspace.identity ||
      other.resources.database === workspace.resources.database ||
      other.resources.bucket === workspace.resources.bucket,
  );
  if (collision) throw new Error(`workspace resources collide with ${collision.path}`);
}

async function completeStep(file, journal, step) {
  journal.pending = journal.pending.filter((candidate) => candidate !== step);
  journal.failures = journal.failures.filter((failure) => failure.step !== step);
  await persistJournal(file, journal);
}

async function failStep(file, journal, step, error) {
  journal.failures = journal.failures.filter((failure) => failure.step !== step);
  journal.failures.push({ step, message: error.message });
  await persistJournal(file, journal);
}

async function executeTeardown(root, file, journal, output) {
  const workspace = journal.workspace;
  if (journal.pending.includes("validation")) {
    output(`Workspace teardown preserved all targets; validation details remain in ${file}.`);
    for (const failure of journal.failures) output(`- ${failure.step}: ${failure.message}`);
    return;
  }
  if (journal.pending.includes("processes")) {
    try {
      const failures = await teardownWorkspaceLeases(root, workspace);
      if (failures.length > 0) throw new Error(failures.join("; "));
      await completeStep(file, journal, "processes");
    } catch (error) {
      await failStep(file, journal, "processes", error);
    }
  }
  if (workspace.profile === "full" && journal.pending.includes("database")) {
    try {
      if (databaseExists(root, workspace)) {
        if (databaseOwnership(root, workspace) !== expectedOwnership(workspace)) {
          throw new Error("database ownership marker is absent or does not match; preserved");
        }
        dropDatabase(root, workspace);
        await completeStep(file, journal, "database");
      } else {
        await completeStep(file, journal, "database");
      }
    } catch (error) {
      await failStep(file, journal, "database", error);
    }
  }
  if (workspace.profile === "full" && journal.pending.includes("bucket")) {
    try {
      if (bucketExists(root, workspace.resources.bucket)) {
        const metadata = bucketMetadata(root, workspace.resources.bucket);
        if (!bucketHasOwnershipMarker(root, metadata, workspace)) {
          throw new Error("bucket ownership labels are absent or do not match; preserved");
        }
        deleteBucket(root, workspace.resources.bucket);
        await completeStep(file, journal, "bucket");
      } else {
        await completeStep(file, journal, "bucket");
      }
    } catch (error) {
      await failStep(file, journal, "bucket", error);
    }
  }
  if (journal.pending.includes("local")) {
    try {
      await rm(path.join(root, ".lazuli/workspace.json"), { force: true });
      await rm(path.join(root, ".lazuli/database-initialization.json"), { force: true });
      await completeStep(file, journal, "local");
    } catch (error) {
      await failStep(file, journal, "local", error);
    }
  }
  if (journal.pending.length === 0) {
    await rm(file);
    output("Workspace teardown complete.");
  } else {
    output(`Workspace teardown left ${journal.pending.length} pending step(s) in ${file}.`);
    for (const failure of journal.failures) output(`- ${failure.step}: ${failure.message}`);
  }
}

export async function teardownWorkspace(
  root,
  output = (message) => process.stdout.write(`${message}\n`),
) {
  return await withFullSetupLock(root, async () => {
    const directory = path.join(commonGitDirectory(root), JOURNAL_DIRECTORY);
    const resumed = await existingJournal(root, directory);
    if (resumed) {
      output(`Resuming workspace teardown from ${resumed.file}.`);
      await executeTeardown(root, resumed.file, resumed.journal, output);
      return;
    }
    let workspace;
    try {
      workspace = await readJson(path.join(root, ".lazuli/workspace.json"));
    } catch (error) {
      if (error.code === "ENOENT") {
        output("Workspace teardown already complete.");
        return;
      }
      const file = path.join(directory, `${rootHash(root)}.json`);
      const journal = {
        version: JOURNAL_VERSION,
        technicalPath: path.resolve(root),
        createdAt: new Date().toISOString(),
        workspace: null,
        pending: ["validation"],
        failures: [
          { step: "validation", message: `workspace metadata is malformed: ${error.message}` },
        ],
      };
      await persistJournal(file, journal);
      await executeTeardown(root, file, journal, output);
      return;
    }
    const file = path.join(directory, `${rootHash(root)}.json`);
    const pending = [
      "validation",
      "processes",
      ...(workspace.profile === "full" ? ["database", "bucket"] : []),
      "local",
    ];
    const journal = {
      version: JOURNAL_VERSION,
      technicalPath: path.resolve(root),
      createdAt: new Date().toISOString(),
      workspace,
      pending,
      failures: [],
    };
    await persistJournal(file, journal);
    try {
      await validateWorkspace(root, workspace);
      await completeStep(file, journal, "validation");
    } catch (error) {
      await failStep(file, journal, "validation", error);
      await executeTeardown(root, file, journal, output);
      return;
    }
    await executeTeardown(root, file, journal, output);
  });
}
