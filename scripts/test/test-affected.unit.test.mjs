import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/test-affected.mjs");

function git(directory, args) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  execFileSync("git", args, { cwd: directory, env: environment, stdio: "ignore" });
}

async function repository({ infrastructure = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-affected-"));
  await write(directory, "package.json", '{"private":true}\n');
  await write(directory, "docs/readme.md", "old\n");
  await write(
    directory,
    "packages/core/package.json",
    `${JSON.stringify({
      name: "@fixture/core",
      scripts: infrastructure ? { test: "true", "test:integration": "true" } : { test: "true" },
    })}\n`,
  );
  await write(directory, "packages/core/src/index.ts", "export const value = 1;\n");
  await write(
    directory,
    "apps/consumer/package.json",
    '{"name":"@fixture/consumer","scripts":{"test":"true"}}\n',
  );
  await fakePnpm(directory);
  git(directory, ["init", "--initial-branch=main"]);
  git(directory, ["config", "user.email", "tests@example.test"]);
  git(directory, ["config", "user.name", "Tests"]);
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "base"]);
  return directory;
}

async function write(directory, relative, contents) {
  const target = path.join(directory, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function fakePnpm(directory) {
  const source = `#!/bin/sh
printf '%s\\n' "$*" >> "$FIXTURE_LOG"
case "$*" in
  *--dry=json*) printf '%s\\n' '{"packages":["@fixture/core","@fixture/consumer"]}' ;;
esac
`;
  await write(directory, "bin/pnpm", source);
  await chmod(path.join(directory, "bin/pnpm"), 0o755);
}

function run(directory, gitEnvironment = {}) {
  const log = path.join(directory, "calls.log");
  const result = spawnSync(process.execPath, [script, "--base", "main"], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      ...gitEnvironment,
      FIXTURE_LOG: log,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
    },
  });
  return { log, result };
}

async function assertAllWorkspacesSelected(log, { allRootChecks = false } = {}) {
  const calls = await readFile(log, "utf8");
  assert.doesNotMatch(calls, /--filter=/u);
  assert.match(calls, /exec turbo run test:scripts /u);
  if (!allRootChecks) return;
  assert.match(calls, / test:component-lines /u);
  assert.match(calls, / test:styles(\n|$)/u);
}

it("uses a transitive-consumer Turbo filter for a changed package", async (context) => {
  const directory = await repository();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/core/src/index.ts", "export const value = 2;\n");

  const { log, result } = run(directory);

  assert.equal(result.status, 0);
  const calls = await readFile(log, "utf8");
  assert.match(calls, /--filter=\.\.\.@fixture\/core/u);
  assert.doesNotMatch(calls, /exec turbo run test:scripts /u);
});

it("selects every workspace for repository infrastructure and none for docs-only changes", async (context) => {
  const rootDirectory = await repository();
  context.after(() => rm(rootDirectory, { force: true, recursive: true }));
  await write(rootDirectory, "package.json", '{"private":true,"changed":true}\n');
  const rootRun = run(rootDirectory);

  assert.equal(rootRun.result.status, 0);
  await assertAllWorkspacesSelected(rootRun.log, { allRootChecks: true });

  const scriptDirectory = await repository();
  context.after(() => rm(scriptDirectory, { force: true, recursive: true }));
  await write(scriptDirectory, "scripts/run-test-tier.mjs", "export {};\n");
  const scriptRun = run(scriptDirectory);

  assert.equal(scriptRun.result.status, 0);
  await assertAllWorkspacesSelected(scriptRun.log);

  const docsDirectory = await repository();
  context.after(() => rm(docsDirectory, { force: true, recursive: true }));
  await write(docsDirectory, "docs/readme.md", "new\n");
  const docsRun = run(docsDirectory);
  assert.equal(docsRun.result.status, 0);
  assert.match(docsRun.result.stdout, /No application workspaces affected/u);
});

it("ignores inherited Git hook variables while finding the merge base", async (context) => {
  const directory = await repository();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/core/src/index.ts", "export const value = 3;\n");

  const { result } = run(directory, {
    GIT_DIR: "/missing",
    GIT_INDEX_FILE: "/missing-index",
    GIT_WORK_TREE: "/missing-tree",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Affected tests passed/u);
});

it("fails with workspace setup instructions when infrastructure tests lack an environment", async (context) => {
  const directory = await repository({ infrastructure: true });
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/core/src/index.ts", "export const value = 4;\n");

  const { result } = run(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /pnpm workspace:setup full/u);
});

it("runs reporting-tool checks without requiring application infrastructure", async (context) => {
  const directory = await repository({ infrastructure: true });
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "scripts/test-durations.mjs", "export {};\n");

  const { log, result } = run(directory);

  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(log, "utf8");
  assert.match(calls, /exec turbo run test:scripts/u);
  assert.doesNotMatch(calls, /prisma|test:integration|test:transport/u);
});

it("keeps integration and transport tasks in one serial invocation", async (context) => {
  const directory = await repository();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/core/src/index.ts", "export const value = 2;\n");

  const { log, result } = run(directory);

  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(log, "utf8");
  assert.match(
    calls,
    /run test:integration test:transport --filter=\.\.\.@fixture\/core --concurrency=1/u,
  );
});
