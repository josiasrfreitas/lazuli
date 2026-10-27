import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { it } from "node:test";

import { applySuppressions } from "../suppressions.js";
import { lintFiles } from "../run-oxlint.mjs";

const cwd = "/workspace";
const ruleId = "@typescript-eslint/no-restricted-types";
const allowances = { "source.ts": { [ruleId]: { count: 2 } } };

function result(count) {
  return {
    filePath: path.join(cwd, "source.ts"),
    messages: Array.from({ length: count }, () => ({ ruleId, severity: 2 })),
    suppressedMessages: [],
  };
}

it("allows exactly the recorded count without disabling unrelated rules or warnings", () => {
  const source = result(2);
  source.messages.push(
    { ruleId: "no-console", severity: 2 },
    { ruleId: "sonarjs/no-duplicate-string", severity: 1 },
  );
  applySuppressions([source], { suppressions: allowances, cwd });
  assert.equal(source.suppressedMessages.length, 2);
  assert.deepEqual(
    source.messages.map((message) => message.ruleId),
    ["no-console", "sonarjs/no-duplicate-string"],
  );
});

it("reports every violation again when a file exceeds its allowance", () => {
  const source = result(3);
  applySuppressions([source], { suppressions: allowances, cwd });
  assert.equal(source.messages.length, 3);
  assert.equal(source.suppressedMessages.length, 0);
});

it("fails on stale allowances, including a checked file with no diagnostics", () => {
  for (const count of [0, 1]) {
    const source = result(count);
    applySuppressions([source], { suppressions: allowances, cwd });
    assert.equal(source.messages.length, 1);
    assert.equal(source.messages[0].ruleId, "lazuli/unused-suppression");
    assert.match(source.messages[0].message, /unused suppression/u);
  }
});

it("does not apply one file's allowance to another file", () => {
  const source = result(2);
  source.filePath = path.join(cwd, "another.ts");
  applySuppressions([source], { suppressions: allowances, cwd });
  assert.equal(source.messages.length, 2);
  assert.equal(source.suppressedMessages.length, 0);
});

it("rejects malformed count limits", () => {
  assert.throws(
    () =>
      applySuppressions([result(1)], {
        suppressions: { "source.ts": { [ruleId]: { count: -1 } } },
        cwd,
      }),
    /Invalid suppression count/u,
  );
});

it("applies existing manifests to real Oxlint results and checks clean selected files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-lint-allowances-"));
  try {
    const legacy = path.join(directory, "legacy.ts");
    const fresh = path.join(directory, "fresh.ts");
    await writeFile(legacy, "export type First = unknown; export type Second = unknown;");
    await writeFile(fresh, "export type Fresh = unknown;");
    await writeFile(
      path.join(directory, "eslint-suppressions.json"),
      JSON.stringify({
        "legacy.ts": { [ruleId]: { count: 2 } },
      }),
    );
    const config = {
      plugins: ["typescript"],
      categories: { correctness: "off" },
      rules: {
        "typescript/no-restricted-types": ["error", { types: { unknown: "Use a concrete type" } }],
      },
    };
    const run = (files) => lintFiles({ cwd: directory, files, config });
    const results = await run([legacy, fresh]);
    assert.equal(results.find((entry) => entry.filePath === legacy).messages.length, 0);
    assert.equal(results.find((entry) => entry.filePath === legacy).suppressedMessages.length, 2);
    assert.equal(results.find((entry) => entry.filePath === fresh).messages[0].ruleId, ruleId);

    await writeFile(legacy, "export type Clean = string;");
    const selected = await run([legacy]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].messages[0].ruleId, "lazuli/unused-suppression");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
