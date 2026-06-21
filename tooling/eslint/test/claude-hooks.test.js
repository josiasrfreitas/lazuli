import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import { spawnSync } from "node:child_process";

import { getTestEnvironment } from "./env.js";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const protectHook = path.join(repositoryRoot, "scripts/guardrails/protect-files.mjs");
const lintHook = path.join(repositoryRoot, "scripts/guardrails/lint-edited-file.mjs");

function runHook({ extraEnvironment = {}, input, scriptPath }) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: getTestEnvironment({ CLAUDE_PROJECT_DIR: repositoryRoot, ...extraEnvironment }),
    input: JSON.stringify(input),
  });
}

it("Claude Code blocks direct edits to guardrail configuration", () => {
  const result = runHook({
    input: {
      tool_input: { file_path: path.join(repositoryRoot, "apps/web/tsconfig.json") },
      tool_name: "Edit",
    },
    scriptPath: protectHook,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /guardrail configuration/u);
});

it("Claude Code allows edits to ordinary source files", () => {
  const result = runHook({
    input: {
      tool_input: { file_path: path.join(repositoryRoot, "apps/web/src/app/page.tsx") },
      tool_name: "Edit",
    },
    scriptPath: protectHook,
  });

  assert.equal(result.status, 0);
});

it("Claude Code reports lint failures and stops after three feedback attempts", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "lazuli-guardrail-"));
  const statePath = path.join(temporaryDirectory, "attempts.json");
  const fixturePath = path.join(repositoryRoot, "apps/worker/src/guardrail-hook-fixture.ts");
  const input = {
    session_id: "guardrail-test-session",
    tool_input: { file_path: fixturePath },
    tool_name: "Edit",
  };

  await writeFile(fixturePath, 'console.log("not allowed");\n');

  try {
    const environment = { LAZULI_GUARDRAIL_STATE_PATH: statePath };
    const attempts = [
      runHook({ extraEnvironment: environment, input, scriptPath: lintHook }),
      runHook({ extraEnvironment: environment, input, scriptPath: lintHook }),
      runHook({ extraEnvironment: environment, input, scriptPath: lintHook }),
    ];
    const cappedAttempt = runHook({
      extraEnvironment: environment,
      input,
      scriptPath: lintHook,
    });

    assert.ok(attempts.every(({ status }) => status === 2));
    assert.match(attempts[0].stderr, /no-console/u);
    assert.equal(cappedAttempt.status, 2);
    assert.match(cappedAttempt.stderr, /attempt limit/u);
  } finally {
    await rm(fixturePath, { force: true });
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
