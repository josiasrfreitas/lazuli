import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../quality-changed.mjs");
const committedSource = `import assert from "node:assert/strict";
import { it } from "node:test";
it("touched old title", () => {
  const value = Date.now();
  assert.equal(value, value);
});
it("untouched legacy", () => {
  assert.ok(true);
});
`;

function git(directory, args) {
  execFileSync("git", args, { cwd: directory, stdio: "ignore" });
}

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-quality-"));
  git(directory, ["init", "--initial-branch=main"]);
  git(directory, ["config", "user.email", "tests@example.test"]);
  git(directory, ["config", "user.name", "Tests"]);
  await mkdir(path.join(directory, "test"));
  await writeFile(path.join(directory, "test", "sample.unit.test.ts"), committedSource);
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "base"]);
  return directory;
}

function run(directory, args, environment = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

it("checks a partially changed test function as a unit and ignores its untouched neighbor", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(
    path.join(directory, "test", "sample.unit.test.ts"),
    committedSource.replace("touched old title", "touched new title"),
  );

  const result = run(directory, ["--base", "main"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no-identical-assertion-arguments/u);
  assert.doesNotMatch(result.stderr, /no-constant-assertion/u);
  assert.match(result.stderr, /docs\/testing\/README\.md/u);
});

it("uses the staged diff and ignores Git hook path overrides", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(
    path.join(directory, "test", "sample.unit.test.ts"),
    committedSource.replace("touched old title", "staged title"),
  );
  git(directory, ["add", "."]);
  await writeFile(
    path.join(directory, "test", "sample.unit.test.ts"),
    'import assert from "node:assert/strict";\nimport { it } from "node:test";\nit("worktree only", () => assert.equal(Date.now() > 0, true));\n',
  );

  const result = run(directory, ["--staged"], {
    GIT_DIR: path.join(directory, ".git", "missing"),
    GIT_INDEX_FILE: path.join(directory, ".git", "missing-index"),
    GIT_WORK_TREE: "/missing",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no-identical-assertion-arguments/u);
});

it("checks a new untracked test file in full", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(
    path.join(directory, "test", "new.unit.test.ts"),
    'import assert from "node:assert";\nassert.ok(true);\n',
  );

  const result = run(directory, ["--base", "main"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /strict-assert-import/u);
  assert.match(result.stderr, /no-constant-assertion/u);
});
