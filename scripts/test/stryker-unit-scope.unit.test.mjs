import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createStrykerConfig } from "../../tooling/stryker/base.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

it("mutation kills a unit-covered mutant without executing integration or transport tests", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-unit-mutation-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "src"));
  await mkdir(path.join(directory, "test"));
  await symlink(
    path.join(root, "tooling/stryker/node_modules"),
    path.join(directory, "node_modules"),
  );
  await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
  await writeFile(
    path.join(directory, "src/value.ts"),
    "export function enabled() { return true; }\n",
  );
  await writeFile(
    path.join(directory, "test/value.unit.test.ts"),
    'import { it } from "node:test";\nimport assert from "node:assert/strict";\n' +
      'import { enabled } from "../src/value.ts";\nit("enabled", () => assert.equal(enabled(), true));\n',
  );
  await writeFile(
    path.join(directory, "src/infrastructure.ts"),
    "export function persist(value) { if (value) { return true; } return false; }\n",
  );
  for (const tier of ["integration", "transport"]) {
    await writeFile(
      path.join(directory, `test/value.${tier}.test.ts`),
      'throw new Error("Infrastructure tests must not run during mutation");\n',
    );
  }
  const config = createStrykerConfig();
  config.tap.nodeArgs = [
    "--test-reporter=tap",
    "--import",
    path.join(root, "node_modules/tsx/dist/loader.mjs"),
  ];
  await writeFile(
    path.join(directory, "stryker.config.json"),
    JSON.stringify({
      ...config,
      concurrency: 1,
      incremental: false,
      reporters: ["json"],
    }),
  );
  const output = execFileSync(
    process.execPath,
    [path.join(root, "scripts/run-unit-mutation.mjs")],
    {
      cwd: directory,
      env: Object.fromEntries(
        Object.entries({
          ...process.env,
          PATH: `${path.join(root, "tooling/stryker/node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
        }).filter(([name]) => !name.startsWith("NODE_TEST_")),
      ),
      encoding: "utf8",
      stdio: "pipe",
      timeout: 60_000,
    },
  );
  const report = JSON.parse(
    await readFile(path.join(directory, "reports/mutation/report.json"), "utf8"),
  );
  assert.match(output, /Unit-covered mutation score: 100\.00%/u);
  assert.deepEqual(
    [...new Set(report.files["src/infrastructure.ts"].mutants.map((mutant) => mutant.status))],
    ["NoCoverage"],
  );
  assert.ok(report.files["src/value.ts"].mutants.length > 0);
  assert.deepEqual(
    [...new Set(report.files["src/value.ts"].mutants.map((mutant) => mutant.status))],
    ["Killed"],
    JSON.stringify(report.files),
  );
});
