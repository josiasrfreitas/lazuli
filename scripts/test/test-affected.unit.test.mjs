import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { classifyChanges } from "../lib/check-scope.mjs";
import {
  createDatabaseIdentity,
  isValidOwnership,
  validateTemporaryDatabaseName,
} from "../lib/ephemeral-test-database.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const affectedScript = path.join(root, "scripts/test-affected.mjs");
const prePushScript = path.join(root, "scripts/check-pre-push.mjs");
const preCommitScript = path.join(root, "scripts/check-pre-commit.mjs");

it("classifies documentation, light scripts, full setup, schema, and global configuration by impact", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-scope-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/db/package.json", '{"name":"@fixture/db"}\n');
  assert.deepEqual(
    classifyChanges(["docs/testing.md"], { root: directory }).workspaceDirectories,
    [],
  );
  assert.equal(
    classifyChanges(["scripts/storybook.mjs"], { root: directory }).forceInfrastructureTiers,
    false,
  );
  assert.equal(
    classifyChanges(["scripts/workspace-setup.mjs"], { root: directory }).workspaceIntegration,
    true,
  );
  assert.equal(classifyChanges(["orca.yaml"], { root: directory }).workspaceIntegration, true);
  assert.equal(
    classifyChanges(["packages/db/prisma/schema.prisma"], { root: directory })
      .forceInfrastructureTiers,
    true,
  );
  assert.equal(classifyChanges(["pnpm-lock.yaml"], { root: directory }).all, true);
  assert.throws(
    () => classifyChanges(["scripts/new-command.mjs"], { root: directory }),
    /Unclassified executable/u,
  );
});

it("builds unique safe database names within PostgreSQL's identifier limit", () => {
  const first = createDatabaseIdentity({
    workspaceIdentity: "Feature/Very Long Name".repeat(8),
    token: "aaaaaaaaaaaa",
  });
  const second = createDatabaseIdentity({
    workspaceIdentity: "Feature/Very Long Name".repeat(8),
    token: "bbbbbbbbbbbb",
  });
  assert.ok(first.length <= 63);
  assert.match(first, /^lazuli_hook_[a-z0-9_]+$/u);
  assert.notEqual(first, second);
  assert.equal(validateTemporaryDatabaseName(first), first);
  assert.throws(() => validateTemporaryDatabaseName("lazuli"), /Unsafe/u);
  const owner = {
    kind: "lazuli-pre-push",
    host: hostname(),
    pid: 123,
    technicalPath: "/tmp/worktree",
    createdAt: "2026-09-20T12:00:00.000Z",
    token: "aaaaaaaaaaaa",
  };
  assert.equal(isValidOwnership({ name: first, owner }), true);
  assert.equal(isValidOwnership({ name: first, owner: { ...owner, token: "ambiguous" } }), false);
});

it("keeps staged and merge-base sources independent and excludes local changes from pre-push", async (context) => {
  const directory = await repository(context);
  await write(directory, "packages/core/src/index.ts", "export const value = 2;\n");
  git(directory, ["add", "."]);
  const staged = run(directory, affectedScript, ["--staged", "--unit-only"]);
  assert.equal(staged.result.status, 0, staged.result.stderr);
  assert.match(await readFile(staged.log, "utf8"), /--filter=\.\.\.@fixture\/core/u);

  await writeFile(staged.log, "");
  const pushed = run(directory, prePushScript, ["--base", "main"]);
  assert.equal(pushed.result.status, 0, pushed.result.stderr);
  assert.equal(await readFile(pushed.log, "utf8"), "");
  assert.match(pushed.result.stdout, /Classification: empty/u);
});

it("pre-push uses filtered lint, typecheck and build for committed package changes", async (context) => {
  const directory = await repository(context);
  await write(directory, "packages/core/src/index.ts", "export const value = 3;\n");
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "change"]);
  const { result, log } = run(directory, prePushScript, ["--base", "main"]);
  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(log, "utf8");
  assert.match(calls, /turbo run lint --filter=\.\.\.@fixture\/core/u);
  assert.match(calls, /turbo run typecheck --filter=\.\.\.@fixture\/core/u);
  assert.match(calls, /turbo run build --filter=\.\.\.@fixture\/core/u);
  assert.doesNotMatch(
    calls,
    /(^|\n)(?!.*--dry=json).*\b(?:docker|prisma|test:integration|test:transport)\b/u,
  );
});

it("pre-commit runs staged lint and unit tests without compilation or infrastructure", async (context) => {
  const directory = await repository(context);
  await write(directory, "packages/core/src/index.ts", "export const value = 4;\n");
  git(directory, ["add", "."]);
  const { result, log } = run(directory, preCommitScript, [], {
    GIT_DIR: "/wrong-repository",
    GIT_INDEX_FILE: "/wrong-index",
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(log, "utf8");
  assert.match(calls, /exec eslint packages\/core\/src\/index\.ts/u);
  assert.match(calls, /test:quality:changed --staged/u);
  assert.match(calls, /turbo run test --filter=\.\.\.@fixture\/core/u);
  assert.doesNotMatch(calls, /typecheck|build|integration|transport|docker|prisma/u);
});

it("fails infrastructure preflight before expensive checks and never starts services", async (context) => {
  const directory = await repository(context, { infrastructure: true });
  await write(directory, "packages/core/src/index.ts", "export const value = 5;\n");
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "database change"]);
  await write(
    directory,
    "bin/docker",
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FIXTURE_LOG"\nexit 1\n`,
  );
  await chmod(path.join(directory, "bin/docker"), 0o755);
  const { result, log } = run(directory, prePushScript, ["--base", "main"]);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Docker is unavailable.*No service was started automatically.*docker info/su,
  );
  const calls = await readFile(log, "utf8");
  assert.match(calls, /^\|exec turbo .*--dry=json\nversion --format/u);
  assert.doesNotMatch(calls, /compose up|turbo run lint --filter|prisma:deploy/u);
});

it("migrates and runs infrastructure tiers on one temporary database without seed, then drops it", async (context) => {
  const directory = await repository(context, { infrastructure: true, transport: true });
  await write(directory, "packages/core/src/index.ts", "export const value = 6;\n");
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "infrastructure change"]);
  await write(
    directory,
    "bin/docker",
    `#!/bin/sh
printf 'docker:%s\\n' "$*" >> "$FIXTURE_LOG"
case "$1" in
  version) printf '26.0.0\\n' ;;
  inspect) printf 'running|healthy|lazuli|postgres\\n' ;;
esac
`,
  );
  await chmod(path.join(directory, "bin/docker"), 0o755);
  const { result, log } = run(directory, prePushScript, ["--base", "main"]);
  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(log, "utf8");
  const databaseUrls = [
    ...calls.matchAll(/(postgresql:\/\/lazuli:lazuli@127\.0\.0\.1:5432\/lazuli_hook_[a-z0-9_]+)/gu),
  ].map((match) => match[1]);
  assert.ok(databaseUrls.length >= 4);
  assert.equal(new Set(databaseUrls).size, 1);
  assert.match(calls, /prisma:deploy/u);
  assert.match(calls, /prisma:drift/u);
  assert.match(calls, /test:integration.*--concurrency=1/u);
  assert.match(calls, /test:transport.*--concurrency=1/u);
  assert.doesNotMatch(calls, /prisma:seed|workspace:reset|compose up/u);
  assert.match(calls, /DROP DATABASE "lazuli_hook_/u);
});

async function repository(context, { infrastructure = false, transport = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-affected-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "package.json", '{"private":true}\n');
  await write(directory, "docs/readme.md", "base\n");
  const scripts = { lint: "true", typecheck: "true", build: "true", test: "true" };
  if (infrastructure) scripts["test:integration"] = "true";
  if (transport) scripts["test:transport"] = "true";
  await write(
    directory,
    "packages/core/package.json",
    `${JSON.stringify({ name: "@fixture/core", scripts })}\n`,
  );
  await write(directory, "packages/core/src/index.ts", "export const value = 1;\n");
  await fakePnpm(directory);
  git(directory, ["init", "--initial-branch=main"]);
  git(directory, ["config", "user.email", "tests@example.test"]);
  git(directory, ["config", "user.name", "Tests"]);
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "base"]);
  git(directory, ["switch", "-c", "feature"]);
  return directory;
}

async function fakePnpm(directory) {
  await write(
    directory,
    "bin/pnpm",
    `#!/bin/sh\nprintf '%s|%s\\n' "$DATABASE_URL" "$*" >> "$FIXTURE_LOG"\ncase "$*" in *--dry=json*) printf '%s\\n' '{"packages":["@fixture/core"]}' ;; esac\n`,
  );
  await chmod(path.join(directory, "bin/pnpm"), 0o755);
}
async function write(directory, relative, contents) {
  const target = path.join(directory, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}
function git(directory, args) {
  execFileSync("git", args, {
    cwd: directory,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    stdio: "ignore",
  });
}
function run(directory, script, args, environment = {}) {
  const log = path.join(directory, "calls.log");
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== "DATABASE_URL"),
  );
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...inheritedEnvironment,
      ...environment,
      FIXTURE_LOG: log,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
    },
  });
  return { result, log };
}
