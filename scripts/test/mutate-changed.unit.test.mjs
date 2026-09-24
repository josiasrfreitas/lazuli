import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mutateChangedScript = path.join(repositoryRoot, "scripts/mutate-changed.mjs");
const gitExecutable = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const pnpmExecutable = execFileSync("which", ["pnpm"], { encoding: "utf8" }).trim();
const packageDirectory = "packages/api";
const changedSourcePath = `${packageDirectory}/src/postgres.ts`;
const fixtureDotenvValue = "loaded-from-fixture-dotenv";
const instrumentedMutateScript =
  "set -a && . ../../.env && set +a && NODE_ENV=test node ./record-mutate.mjs";

function withoutGitHookEnvironment(environment) {
  const entries = Object.entries(environment).filter(([name]) => !name.startsWith("GIT_"));

  return Object.fromEntries(entries);
}

function buildChildEnvironment(overrides = {}) {
  return withoutGitHookEnvironment({ ...process.env, ...overrides });
}

function git(repositoryDirectory, args) {
  execFileSync(gitExecutable, args, {
    cwd: repositoryDirectory,
    env: buildChildEnvironment(),
    stdio: "ignore",
  });
}

function gitText(repositoryDirectory, args) {
  return execFileSync(gitExecutable, args, {
    cwd: repositoryDirectory,
    encoding: "utf8",
    env: buildChildEnvironment(),
  }).trim();
}

async function writeFixtureFile({ content, relativePath, repositoryDirectory }) {
  const filePath = path.join(repositoryDirectory, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function createChangedPackageFixture(options = {}) {
  const repositoryDirectory = await mkdtemp(path.join(tmpdir(), "lazuli-mutate-changed-"));
  const mutateScript = options.mutateScript ?? instrumentedMutateScript;
  const packageJson = JSON.stringify({
    name: "@lazuli/api",
    private: true,
    scripts: { build: "true", mutate: mutateScript },
  });

  git(repositoryDirectory, ["init", "--initial-branch=main"]);
  git(repositoryDirectory, ["config", "user.email", "tests@example.test"]);
  git(repositoryDirectory, ["config", "user.name", "Tests"]);
  await writeFixtureFile({
    content: '{"private":true,"packageManager":"pnpm@11.6.0"}\n',
    relativePath: "package.json",
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: 'packages:\n  - "packages/*"\n',
    relativePath: "pnpm-workspace.yaml",
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: '{"tasks":{"build":{"dependsOn":["^build"]}}}\n',
    relativePath: "turbo.json",
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: `FIXTURE_DOTENV_VALUE=${fixtureDotenvValue}\n`,
    relativePath: ".env",
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: packageJson,
    relativePath: `${packageDirectory}/package.json`,
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: createRecorderSource(),
    relativePath: `${packageDirectory}/record-mutate.mjs`,
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: "export const value = 1;\n",
    relativePath: changedSourcePath,
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: "export default {};\n",
    relativePath: `${packageDirectory}/stryker.config.mjs`,
    repositoryDirectory,
  });
  await writeFixtureFile({
    content: "",
    relativePath: `${packageDirectory}/test/example.unit.test.ts`,
    repositoryDirectory,
  });
  git(repositoryDirectory, ["add", "."]);
  git(repositoryDirectory, ["commit", "-m", "base"]);
  await writeFixtureFile({
    content: "export const value = 2;\n",
    relativePath: changedSourcePath,
    repositoryDirectory,
  });

  return repositoryDirectory;
}

function createRecorderSource() {
  return `import { writeFileSync } from "node:fs";

writeFileSync(
  process.env.FIXTURE_MUTATE_LOG,
  JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    dotenvValue: process.env.FIXTURE_DOTENV_VALUE,
    nodeEnv: process.env.NODE_ENV,
  }),
);

if (process.env.FIXTURE_MUTATE_FAIL === "1") {
  process.exit(1);
}
`;
}

function createPathValue() {
  return [
    path.join(repositoryRoot, "node_modules", ".bin"),
    path.dirname(pnpmExecutable),
    path.dirname(gitExecutable),
    path.dirname(process.execPath),
    process.env.PATH,
  ].join(path.delimiter);
}

function runMutateChanged(repositoryDirectory, inheritedEnvironment = {}) {
  const logPath = path.join(repositoryDirectory, "mutate-log.json");
  const result = spawnSync(process.execPath, [mutateChangedScript, "--base", "main"], {
    cwd: repositoryDirectory,
    encoding: "utf8",
    env: buildChildEnvironment({
      ...inheritedEnvironment,
      FIXTURE_MUTATE_LOG: logPath,
      PATH: createPathValue(),
    }),
  });

  return { logPath, result };
}

async function readMutateLog(logPath) {
  return JSON.parse(await readFile(logPath, "utf8"));
}

function repositorySnapshot() {
  return {
    head: gitText(repositoryRoot, ["rev-parse", "HEAD"]),
    index: gitText(repositoryRoot, ["ls-files", "--stage"]),
    status: gitText(repositoryRoot, ["status", "--porcelain=v1"]),
  };
}

it("passes --mutate through real pnpm without a literal separator and keeps package env", async (testContext) => {
  const repositoryDirectory = await createChangedPackageFixture();
  testContext.after(() => rm(repositoryDirectory, { force: true, recursive: true }));

  const { logPath, result } = runMutateChanged(repositoryDirectory);

  assert.equal(result.status, 0);
  const log = await readMutateLog(logPath);
  assert.equal(path.relative(await realpath(repositoryDirectory), log.cwd), packageDirectory);
  assert.equal(log.nodeEnv, "test");
  assert.equal(log.dotenvValue, fixtureDotenvValue);
  assert.deepEqual(log.argv, ["--mutate", "src/postgres.ts"]);
  assert.match(result.stdout, /Mutation gate passed for 1 package/u);
});

it("reports a package failure from the delegated mutate script", async (testContext) => {
  const failingMutateScript = "FIXTURE_MUTATE_FAIL=1 node ./record-mutate.mjs";
  const repositoryDirectory = await createChangedPackageFixture({
    mutateScript: failingMutateScript,
  });
  testContext.after(() => rm(repositoryDirectory, { force: true, recursive: true }));

  const { result } = runMutateChanged(repositoryDirectory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mutation gate failed in: packages\/api/u);
  assert.match(result.stderr, /docs\/testing\/README\.md/u);
});

it("keeps packages with only compile-time type tests outside the mutation gate", async (context) => {
  const directory = await createChangedPackageFixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await rm(path.join(directory, packageDirectory, "stryker.config.mjs"));
  await rm(path.join(directory, packageDirectory, "test/example.unit.test.ts"));
  await writeFixtureFile({
    content: "export {};\n",
    relativePath: `${packageDirectory}/test/example.type-test.tsx`,
    repositoryDirectory: directory,
  });

  const { result } = runMutateChanged(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /packages\/api: no unit tests, outside the mutation gate/u);
  assert.doesNotMatch(result.stderr, /no stryker\.config\.mjs/u);
});

it("fails closed when a package has unit tests without mutation configuration", async (context) => {
  const directory = await createChangedPackageFixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await rm(path.join(directory, packageDirectory, "stryker.config.mjs"));

  const { result } = runMutateChanged(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages with unit tests but no stryker\.config\.mjs/u);
});

it("ignores inherited Git hook variables and leaves the real repository index unchanged", async (testContext) => {
  const repositoryDirectory = await createChangedPackageFixture();
  const gitDirectory = gitText(repositoryRoot, ["rev-parse", "--git-dir"]);
  const gitIndexFile = path.resolve(repositoryRoot, gitDirectory, "index");
  const before = repositorySnapshot();
  testContext.after(() => rm(repositoryDirectory, { force: true, recursive: true }));

  const { logPath, result } = runMutateChanged(repositoryDirectory, {
    GIT_DIR: gitDirectory,
    GIT_INDEX_FILE: gitIndexFile,
    GIT_WORK_TREE: repositoryRoot,
  });

  assert.equal(result.status, 0);
  const log = await readMutateLog(logPath);
  assert.deepEqual(log.argv, ["--mutate", "src/postgres.ts"]);
  assert.deepEqual(repositorySnapshot(), before);
});

it("detects mutation scope without invoking builds or mutation, including unconfigured source", async (context) => {
  const directory = await createChangedPackageFixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  const checkScope = () =>
    spawnSync(process.execPath, [mutateChangedScript, "--base", "main", "--scope-only"], {
      cwd: directory,
      encoding: "utf8",
      env: buildChildEnvironment({ PATH: path.dirname(gitExecutable) }),
    });

  const changed = checkScope();
  assert.equal(changed.status, 0, changed.stderr);
  assert.equal(changed.stdout.trim(), "true");
  await rm(path.join(directory, packageDirectory, "stryker.config.mjs"));
  const unconfigured = checkScope();
  assert.equal(unconfigured.status, 0, unconfigured.stderr);
  assert.equal(unconfigured.stdout.trim(), "true");
  await rm(path.join(directory, packageDirectory, "test/example.unit.test.ts"));
  await writeFixtureFile({
    content: "export {};\n",
    relativePath: `${packageDirectory}/test/example.type-test.tsx`,
    repositoryDirectory: directory,
  });
  const typeTestsOnly = checkScope();
  assert.equal(typeTestsOnly.status, 0, typeTestsOnly.stderr);
  assert.equal(typeTestsOnly.stdout.trim(), "false");
  await writeFile(path.join(directory, changedSourcePath), "export const value = 1;\n");
  const empty = checkScope();
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.stdout.trim(), "false");
});

it("keeps web and shared UI changes outside the mutation gate", async (context) => {
  const directory = await createChangedPackageFixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(path.join(directory, changedSourcePath), "export const value = 1;\n");
  const scopes = [];

  for (const frontendDirectory of ["apps/web", "packages/ui"]) {
    await writeFixtureFile({
      content: "export const value = 1;\n",
      relativePath: `${frontendDirectory}/src/example.ts`,
      repositoryDirectory: directory,
    });
    await writeFixtureFile({
      content: "",
      relativePath: `${frontendDirectory}/test/example.unit.test.ts`,
      repositoryDirectory: directory,
    });
    const scope = spawnSync(
      process.execPath,
      [mutateChangedScript, "--base", "main", "--scope-only"],
      {
        cwd: directory,
        encoding: "utf8",
        env: buildChildEnvironment({ PATH: path.dirname(gitExecutable) }),
      },
    );
    scopes.push({ status: scope.status, stdout: scope.stdout.trim(), stderr: scope.stderr });
  }
  assert.deepEqual(scopes, [
    { status: 0, stdout: "false", stderr: "" },
    { status: 0, stdout: "false", stderr: "" },
  ]);

  const { result } = runMutateChanged(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No changed source files under a mutation-tested package/u);
});
