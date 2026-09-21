import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function execute(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : undefined,
  });
}

async function copyCheckout(target) {
  const files = execute("git", ["ls-files", "--cached", "--others", "--exclude-standard"])
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const file of files) {
    try {
      await stat(path.join(repositoryRoot, file));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const destination = path.join(target, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(repositoryRoot, file), destination, { recursive: true });
  }
  await symlink(path.join(repositoryRoot, "node_modules"), path.join(target, "node_modules"));
  await symlink(
    path.join(repositoryRoot, "packages/db/node_modules"),
    path.join(target, "packages/db/node_modules"),
  );
  await symlink(
    path.join(repositoryRoot, "packages/db/src/generated"),
    path.join(target, "packages/db/src/generated"),
  );
  execute("git", ["init", "--quiet"], { cwd: target });
}

function setup(target, profile) {
  return spawnSync("pnpm", ["workspace:setup", profile], {
    cwd: target,
    encoding: "utf8",
    env: process.env,
  });
}

function databaseQuery(database, sql) {
  return execute("docker", [
    "exec",
    "lazuli-postgres",
    "psql",
    "-U",
    "lazuli",
    "-d",
    database,
    "-tAc",
    sql,
  ]).trim();
}

test("full setup isolates real databases and buckets and repeats without data loss", async (context) => {
  const docker = spawnSync("docker", ["compose", "version"], { cwd: repositoryRoot });
  assert.equal(
    docker.status,
    0,
    "Docker Compose is required; start Docker before test:workspace:integration",
  );
  const parent = await mkdtemp(path.join(tmpdir(), "lazuli-full-integration-"));
  const roots = [path.join(parent, "workspace-one"), path.join(parent, "workspace-two")];
  const resources = [];
  context.after(async () => {
    for (const workspace of resources) {
      execute("docker", [
        "exec",
        "lazuli-postgres",
        "psql",
        "-U",
        "lazuli",
        "-d",
        "postgres",
        "-c",
        `DROP DATABASE IF EXISTS ${workspace.resources.database} WITH (FORCE)`,
      ]);
      const object = encodeURIComponent("fixtures/reports/sample-attendance-summary.csv");
      spawnSync("curl", [
        "-fsS",
        "-X",
        "DELETE",
        `http://localhost:4443/storage/v1/b/${workspace.resources.bucket}/o/${object}`,
      ]);
      spawnSync("curl", [
        "-fsS",
        "-X",
        "DELETE",
        `http://localhost:4443/storage/v1/b/${workspace.resources.bucket}`,
      ]);
    }
    await rm(parent, { recursive: true, force: true });
  });

  const setupResults = [];
  for (const root of roots) {
    await mkdir(root);
    await copyCheckout(root);
    const light = setup(root, "light");
    const full = setup(root, "full");
    setupResults.push({ light, full });
    resources.push(JSON.parse(await readFile(path.join(root, ".lazuli/workspace.json"), "utf8")));
  }

  assert.deepEqual(
    setupResults.map(({ light, full }) => [light.status, full.status]),
    [
      [0, 0],
      [0, 0],
    ],
    setupResults.flatMap(({ light, full }) => [light.stderr, full.stderr]).join("\n"),
  );
  assert.notEqual(resources[0].resources.database, resources[1].resources.database);
  assert.notEqual(resources[0].resources.bucket, resources[1].resources.bucket);
  const observations = resources.map((workspace) => {
    const objectUrl = `http://localhost:4443/storage/v1/b/${workspace.resources.bucket}/o/${encodeURIComponent("fixtures/reports/sample-attendance-summary.csv")}`;
    return {
      migrations:
        Number(
          databaseQuery(workspace.resources.database, 'SELECT count(*) FROM "_prisma_migrations"'),
        ) > 0,
      seededStudents:
        Number(databaseQuery(workspace.resources.database, 'SELECT count(*) FROM "Student"')) > 0,
      initializationMarked:
        databaseQuery(
          workspace.resources.database,
          'SELECT count(*) FROM "lazuli_local"."workspace_initializations" WHERE key = \'workspace-full-v1\'',
        ) === "1",
      objectStatus: execute("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code}", objectUrl]),
    };
  });
  assert.deepEqual(observations, [
    { migrations: true, seededStudents: true, initializationMarked: true, objectStatus: "200" },
    { migrations: true, seededStudents: true, initializationMarked: true, objectStatus: "200" },
  ]);

  databaseQuery(
    resources[0].resources.database,
    "CREATE TABLE setup_preservation_marker (value text)",
  );
  databaseQuery(
    resources[0].resources.database,
    "INSERT INTO setup_preservation_marker VALUES ('kept')",
  );
  const repeated = setup(roots[0], "full");

  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(
    databaseQuery(resources[0].resources.database, "SELECT value FROM setup_preservation_marker"),
    "kept",
  );
  assert.match(repeated.stdout, /Keeping existing object/u);
});
