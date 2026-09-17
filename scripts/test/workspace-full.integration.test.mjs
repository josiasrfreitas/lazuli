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

function maintenance(target, command, arguments_ = []) {
  return spawnSync("pnpm", [command, ...arguments_], {
    cwd: target,
    encoding: "utf8",
    env: process.env,
  });
}

function teardown(target) {
  return maintenance(target, "workspace:teardown");
}

function uploadObject(bucket, name, contents) {
  return spawnSync(
    "curl",
    [
      "-fsS",
      "-X",
      "POST",
      "--data-binary",
      contents,
      `http://localhost:4443/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}`,
    ],
    { encoding: "utf8" },
  );
}

function downloadObject(bucket, name) {
  return execute("curl", [
    "-fsS",
    `http://localhost:4443/download/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`,
  ]);
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

test("full setup, maintenance, and teardown isolate real worktree resources", async (context) => {
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

  const fixtureObject = "fixtures/reports/sample-attendance-summary.csv";
  const extraObject = "manual/keep.txt";
  const originalFixture = await readFile(
    path.join(repositoryRoot, "infra/local/gcs-seed", fixtureObject),
    "utf8",
  );
  databaseQuery(
    resources[0].resources.database,
    `INSERT INTO "User" (id, email, name, role, updated_at) VALUES ('00000000-0000-4000-8000-000000000099', 'extra@local.test', 'Extra', 'ADMIN', NOW())`,
  );
  assert.equal(uploadObject(resources[0].resources.bucket, fixtureObject, "edited\n").status, 0);
  assert.equal(uploadObject(resources[0].resources.bucket, extraObject, "keep\n").status, 0);
  const beforeCounts = {
    students: databaseQuery(resources[0].resources.database, 'SELECT count(*) FROM "Student"'),
    seededUser: databaseQuery(
      resources[0].resources.database,
      `SELECT count(*) FROM "User" WHERE email = 'dev@lazuli.local'`,
    ),
  };

  const refreshOne = maintenance(roots[0], "workspace:fixtures", ["refresh"]);
  const refreshTwo = maintenance(roots[0], "workspace:fixtures", ["refresh"]);

  assert.deepEqual([refreshOne.status, refreshTwo.status], [0, 0], refreshOne.stderr);
  assert.deepEqual(
    {
      students: databaseQuery(resources[0].resources.database, 'SELECT count(*) FROM "Student"'),
      seededUser: databaseQuery(
        resources[0].resources.database,
        `SELECT count(*) FROM "User" WHERE email = 'dev@lazuli.local'`,
      ),
    },
    beforeCounts,
  );
  assert.equal(
    databaseQuery(
      resources[0].resources.database,
      `SELECT count(*) FROM "User" WHERE email = 'extra@local.test'`,
    ),
    "1",
  );
  assert.equal(downloadObject(resources[0].resources.bucket, fixtureObject), originalFixture);
  assert.equal(downloadObject(resources[0].resources.bucket, extraObject), "keep\n");

  const siblingStudentCount = databaseQuery(
    resources[1].resources.database,
    'SELECT count(*) FROM "Student"',
  );
  const reset = maintenance(roots[0], "workspace:reset", ["--yes"]);

  assert.equal(reset.status, 0, reset.stderr);
  assert.equal(
    databaseQuery(
      resources[0].resources.database,
      `SELECT count(*) FROM "User" WHERE email = 'extra@local.test'`,
    ),
    "0",
  );
  assert.equal(
    databaseQuery(resources[0].resources.database, 'SELECT count(*) FROM "_prisma_migrations"') > 0,
    true,
  );
  assert.equal(
    databaseQuery(
      resources[0].resources.database,
      `SELECT count(*) FROM "lazuli_local"."workspace_initializations" WHERE key = 'workspace-full-v1'`,
    ),
    "1",
  );
  assert.equal(
    databaseQuery(resources[1].resources.database, 'SELECT count(*) FROM "Student"'),
    siblingStudentCount,
  );
  assert.equal(downloadObject(resources[1].resources.bucket, fixtureObject).length > 0, true);

  const removed = teardown(roots[0]);
  const databaseExists = databaseQuery(
    "postgres",
    `SELECT count(*) FROM pg_database WHERE datname = '${resources[0].resources.database}'`,
  );
  const bucketStatus = execute("curl", [
    "-sS",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    `http://localhost:4443/storage/v1/b/${resources[0].resources.bucket}`,
  ]);
  const siblingBucketStatus = execute("curl", [
    "-sS",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    `http://localhost:4443/storage/v1/b/${resources[1].resources.bucket}`,
  ]);
  const composeRows = execute("docker", ["compose", "ps", "--format", "json"])
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(databaseExists, "0");
  assert.equal(bucketStatus, "404");
  assert.equal(
    databaseQuery(resources[1].resources.database, 'SELECT count(*) FROM "Student"') > 0,
    true,
  );
  assert.equal(siblingBucketStatus, "200");
  assert.equal(
    composeRows.every((row) => String(row.State).toLowerCase() === "running"),
    true,
  );
});
