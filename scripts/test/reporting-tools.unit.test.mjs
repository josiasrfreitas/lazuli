import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const durationsScript = path.join(root, "scripts/test-durations.mjs");
const redundancyScript = path.join(root, "scripts/mutation-redundancy-report.mjs");

async function fixture() {
  return await mkdtemp(path.join(tmpdir(), "lazuli-reports-"));
}

async function write(directory, relative, contents) {
  const target = path.join(directory, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function run(directory, script) {
  return spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
}

it("prints slow JUnit tests and leaves budget warnings non-blocking", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(
    directory,
    "packages/core/reports/junit/unit.xml",
    '<?xml version="1.0"?><testsuites><testsuite name="unit">' +
      '<testcase name="fast" time="3.000" file="test/sample.unit.test.ts"></testcase>' +
      '<testcase name="slow" time="3.200" file="test/sample.unit.test.ts"></testcase>' +
      "</testsuite></testsuites>",
  );

  const result = run(directory, durationsScript);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /slow/u);
  assert.match(result.stderr, /warning: slow took 3\.200s/u);
  assert.match(result.stderr, /test\/sample\.unit\.test\.ts took 6\.200s/u);
});

it("fails when a JUnit report is structurally invalid", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "apps/web/reports/junit/unit.xml", "<not-junit/>");

  const result = run(directory, durationsScript);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid JUnit report/u);
});

it("reports exclusive, shared, and absent mutant kills without blocking", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  const payload = {
    files: {
      "src/index.ts": {
        mutants: [
          { id: "one", killedBy: ["a"], status: "Killed" },
          { id: "two", killedBy: ["a", "b"], status: "Killed" },
          { id: "three", killedBy: [], status: "Survived" },
        ],
      },
    },
    testFiles: {
      "exclusive.test.ts": { tests: [{ id: "a", name: "exclusive" }] },
      "shared-only.test.ts": { tests: [{ id: "b", name: "shared" }] },
      "kills-none.test.ts": { tests: [{ id: "c", name: "none" }] },
    },
  };
  await write(
    directory,
    "packages/core/reports/mutation/report.json",
    `${JSON.stringify(payload)}\n`,
  );

  const result = run(directory, redundancyScript);

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /exclusive\.test/u);
  assert.match(result.stdout, /shared-only\.test/u);
  assert.match(result.stdout, /kills-none\.test/u);
});

it("fails when the Stryker report schema is invalid", async (context) => {
  const directory = await fixture();
  context.after(() => rm(directory, { force: true, recursive: true }));
  await write(directory, "packages/core/reports/mutation/report.json", '{"files":{}}\n');

  const result = run(directory, redundancyScript);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid Stryker schema/u);
});
