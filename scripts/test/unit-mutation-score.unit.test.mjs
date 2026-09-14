import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath, URL } from "node:url";

const script = fileURLToPath(new URL("../run-unit-mutation.mjs", import.meta.url));

async function run(context, statuses, { failure = false, missing = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-covered-score-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const report = { files: { "src/value.ts": { mutants: statuses.map((status) => ({ status })) } } };
  const command = `#!${process.execPath}
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("reports/mutation", { recursive: true });
${missing ? "" : `writeFileSync("reports/mutation/report.json", ${JSON.stringify(JSON.stringify(report))});`}
process.exit(${failure ? 1 : 0});
`;
  await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
  await writeFile(path.join(directory, "stryker"), command, { mode: 0o755 });
  await mkdir(path.join(directory, "reports/mutation"), { recursive: true });
  await writeFile(path.join(directory, "reports/mutation/report.json"), JSON.stringify(report));
  return spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
  });
}

it("passes at 70 percent of unit-covered mutants despite uncovered integration code", async (context) => {
  const result = await run(context, [
    ...Array.from({ length: 7 }, () => "Killed"),
    ...Array.from({ length: 3 }, () => "Survived"),
    ...Array.from({ length: 20 }, () => "NoCoverage"),
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /70\.00% \(7\/10; 20 uncovered excluded\)/u);
});

it("fails below the unit-covered threshold", async (context) => {
  const result = await run(context, ["Killed", "Timeout", "Survived"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /66\.67%/u);
});

it("reports no unit-covered mutants as N/A", async (context) => {
  const result = await run(context, ["NoCoverage", "Ignored", "CompileError"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /N\/A/u);
});

it("fails runtime errors even when all scored mutants are killed", async (context) => {
  const result = await run(context, ["Killed", "RuntimeError"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /runtime errors/u);
});

it("propagates failed Stryker runs instead of accepting their report", async (context) => {
  const result = await run(context, ["Killed"], { failure: true });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /Unit-covered mutation score/u);
});

it("rejects stale reports when Stryker emits no fresh report", async (context) => {
  const result = await run(context, ["Killed"], { missing: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/u);
});
