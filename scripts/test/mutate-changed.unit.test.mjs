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
    scripts: { mutate: mutateScript },
  });

  git(repositoryDirectory, ["init", "--initial-branch=main"]);
  git(repositoryDirectory, ["config", "user.email", "tests@example.test"]);
  git(repositoryDirectory, ["config", "user.name", "Tests"]);
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
  const repositoryDirectory = await createChangedPackageFixture({ mutateScript: failingMutateScript });
  testContext.after(() => rm(repositoryDirectory, { force: true, recursive: true }));

  const { result } = runMutateChanged(repositoryDirectory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mutation gate failed in: packages\/api/u);
  assert.match(result.stderr, /docs\/testing\/README\.md/u);
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
