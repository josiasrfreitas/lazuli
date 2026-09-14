import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath, URL } from "node:url";

const script = fileURLToPath(new URL("../mutation-cache-key.mjs", import.meta.url));
const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

async function write(directory, file, source) {
  const target = path.join(directory, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source);
}

function fingerprint(directory, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: environment,
  }).trim();
}

it("invalidates incremental reuse for helpers, dependencies, fixtures and configuration", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-mutation-inputs-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: directory, env: environment });
  const inputs = [
    "packages/api/test/support/assert-order.ts",
    "packages/domain/src/order.ts",
    "packages/api/test/fixtures/order.json",
    "packages/api/tsconfig.json",
    ".github/workflows/ci.yml",
    ".github/actions/setup/action.yml",
    "pnpm-lock.yaml",
  ];
  for (const file of inputs) await write(directory, file, "original\n");
  execFileSync("git", ["add", "."], { cwd: directory, env: environment });
  const original = fingerprint(directory);

  for (const file of inputs) {
    await write(directory, file, "changed\n");
    assert.notEqual(fingerprint(directory), original, file);
    await write(directory, file, "original\n");
  }
  assert.equal(fingerprint(directory), original);
  await rm(path.join(directory, inputs[0]));
  assert.notEqual(fingerprint(directory), original, "deleted helper");
});

it("invalidates reuse when the comparison base changes mutation scope for the same source tree", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-mutation-scope-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const git = (args) =>
    execFileSync("git", args, { cwd: directory, env: environment, stdio: "ignore" });
  git(["init", "--quiet"]);
  await write(directory, "packages/api/src/order.ts", "export const value = 1;\n");
  git(["add", "."]);
  git(["-c", "user.name=Tests", "-c", "user.email=tests@example.test", "commit", "-m", "base"]);
  await write(directory, "packages/api/src/order.ts", "export const value = 2;\n");
  git(["add", "."]);
  git(["-c", "user.name=Tests", "-c", "user.email=tests@example.test", "commit", "-m", "change"]);

  assert.notEqual(
    fingerprint(directory, ["--base", "HEAD"]),
    fingerprint(directory, ["--base", "HEAD~1"]),
  );
});

it("reuses inputs across documentation changes but detects new untracked helpers", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-mutation-docs-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: directory, env: environment });
  await write(directory, "packages/api/src/order.ts", "export const value = 1;\n");
  const original = fingerprint(directory);

  await write(directory, "docs/testing/README.md", "Documentation changed\n");
  await write(directory, "README.md", "Project documentation changed\n");
  assert.equal(fingerprint(directory), original);
  await write(directory, "packages/api/test/support/new-helper.ts", "export {};\n");
  assert.notEqual(fingerprint(directory), original);
});

it("fingerprints tracked directory symlinks without trying to read them as files", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-mutation-links-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: directory, env: environment });
  await write(directory, "docs/skill/SKILL.md", "Instructions\n");
  await mkdir(path.join(directory, ".claude/skills"), { recursive: true });
  const link = path.join(directory, ".claude/skills/example");
  await symlink("../../docs/skill", link);
  const original = fingerprint(directory);
  assert.equal(fingerprint(directory), original);
  await rm(link);
  await symlink("../../docs", link);
  assert.notEqual(fingerprint(directory), original);
});
