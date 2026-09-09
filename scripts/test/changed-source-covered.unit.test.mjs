import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/changed-source-covered.mjs");

function git(directory, args) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  execFileSync("git", args, { cwd: directory, env: environment, stdio: "ignore" });
}

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-coverage-"));
  await write(directory, "packages/core/package.json", '{"name":"@fixture/core","scripts":{"test":"true"}}\n');
  await write(directory, "packages/core/src/index.ts", "export const value = 1;\n");
  git(directory, ["init", "--initial-branch=main"]);
  git(directory, ["config", "user.email", "tests@example.test"]);
  git(directory, ["config", "user.name", "Tests"]);
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "base"]);
  await write(directory, "packages/core/src/index.ts", "export const value = 2;\n");
  return directory;
}

async function write(directory, relative, contents) {
  const target = path.join(directory, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function run(directory, extra = [], environment = {}) {
  return spawnSync(process.execPath, [script, "--base", "main", ...extra], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

async function writeLcov(directory, contents) {
  await write(directory, "packages/core/coverage/unit/lcov.info", contents);
}

it("accepts a changed source file with executed lines in an existing report", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await writeLcov(directory, "TN:\nSF:src/index.ts\nLF:1\nLH:1\nend_of_record\n");

  const result = run(directory, ["--reports"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /every changed source file has LH > 0/u);
});

it("distinguishes LH zero from missing and malformed reports", async (context) => {
  const zeroDirectory = await fixture();
  context.after(() => rm(zeroDirectory, { force: true, recursive: true }));
  await writeLcov(zeroDirectory, "TN:\nSF:src/index.ts\nLF:1\nLH:0\nend_of_record\n");
  const zero = run(zeroDirectory, ["--reports"]);
  assert.equal(zero.status, 1);
  assert.match(zero.stderr, /LH=0/u);

  const missingDirectory = await fixture();
  context.after(() => rm(missingDirectory, { force: true, recursive: true }));
  const missing = run(missingDirectory, ["--reports"]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /Missing LCOV report/u);

  const malformedDirectory = await fixture();
  context.after(() => rm(malformedDirectory, { force: true, recursive: true }));
  await writeLcov(malformedDirectory, "not-lcov\n");
  const malformed = run(malformedDirectory, ["--reports"]);
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /Malformed LCOV report/u);
});

it("reports a test or environment failure separately from coverage", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  const binary = path.join(directory, "bin", "pnpm");
  await write(directory, "bin/pnpm", "#!/bin/sh\nexit 7\n");
  await chmod(binary, 0o755);

  const result = run(directory, [], {
    PATH: `${path.dirname(binary)}${path.delimiter}${process.env.PATH}`,
  });

  assert.equal(result.status, 7);
  assert.match(result.stderr, /tests or environment failed/u);
  assert.doesNotMatch(result.stderr, /LH=0/u);
});
