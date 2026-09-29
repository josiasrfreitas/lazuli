import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const script = resolve("scripts/ship-it.sh");

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ship-it-"));
  const remote = join(root, "remote.git");
  const main = join(root, "main");
  const writer = join(root, "writer");
  const bin = join(root, "bin");
  mkdirSync(bin);
  run("git", ["init", "--bare", "-b", "main", remote]);
  run("git", ["clone", remote, main]);
  run("git", ["-C", main, "config", "user.email", "test@example.com"]);
  run("git", ["-C", main, "config", "user.name", "Test"]);
  writeFileSync(join(main, "file"), "initial\n");
  run("git", ["-C", main, "add", "file"]);
  run("git", ["-C", main, "commit", "-m", "initial"]);
  run("git", ["-C", main, "push", "origin", "main"]);
  run("git", ["clone", remote, writer]);
  run("git", ["-C", writer, "config", "user.email", "test@example.com"]);
  run("git", ["-C", writer, "config", "user.name", "Test"]);
  writeFileSync(join(writer, "file"), "updated\n");
  run("git", ["-C", writer, "commit", "-am", "updated"]);
  run("git", ["-C", writer, "push", "origin", "main"]);
  const log = join(root, "calls");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SHIP_TEST_MAIN: main,
    SHIP_TEST_ROOT: root,
    SHIP_TEST_LOG: log,
  };
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/bash
if [[ "$1 $2" == "repo view" ]]; then echo owner/repo; elif [[ "$1 $2" == "issue view" ]]; then echo 123; else echo https://github.com/owner/repo/pull/42; fi
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "orca"),
    `#!/bin/bash
if [[ "$1" == status ]]; then echo '{"ok":true}'; exit; fi
[[ "$(git -C "$SHIP_TEST_MAIN" rev-parse HEAD)" == "$(git -C "$SHIP_TEST_MAIN" rev-parse origin/main)" ]] || exit 27
printf 'orca\\n' >> "$SHIP_TEST_LOG"
git -C "$SHIP_TEST_MAIN" worktree add -q -b issue-123 "$SHIP_TEST_ROOT/issue-123"
printf '{"ok":true,"result":{"worktree":{"path":"%s"}}}\\n' "$SHIP_TEST_ROOT/issue-123"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "codex"),
    `#!/bin/bash
printf 'codex %s\\n' "$*" >> "$SHIP_TEST_LOG"
while (($#)); do if [[ "$1" == --output-last-message ]]; then printf 'STATUS: %s\\n1. Implement and test.\\n' "\${SHIP_TEST_PLAN_STATUS:-READY}" > "$2"; exit; fi; shift; done
cat >/dev/null
`,
    { mode: 0o755 },
  );
  return { main, log, env };
}

test("updates main before Orca creates a worktree and passes model settings through all phases", () => {
  const { main, log, env } = fixture();
  run("bash", [script, "123", "--model", "gpt-6-astra", "--effort", "high"], { cwd: main, env });
  assert.equal(readFileSync(join(main, "file"), "utf8"), "updated\n");
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(calls.length, 4);
  assert.equal(calls[0], "orca");
  assert.ok(
    calls
      .slice(1)
      .every(
        (call) =>
          call.includes("--model gpt-6-astra") && call.includes('model_reasoning_effort="high"'),
      ),
  );
});

test("refuses a dirty main before calling Orca or Codex", () => {
  const { main, log, env } = fixture();
  writeFileSync(join(main, "file"), "dirty\n");
  assert.throws(
    () => run("bash", [script, "123"], { cwd: main, env, stdio: "pipe" }),
    /Main worktree is dirty/,
  );
  assert.throws(() => readFileSync(log), { code: "ENOENT" });
});

test("stops before implementation when the plan is blocked", () => {
  const { main, log, env } = fixture();
  env.SHIP_TEST_PLAN_STATUS = "BLOCKED";
  assert.throws(
    () => run("bash", [script, "123"], { cwd: main, env, stdio: "pipe" }),
    /Plan is blocked/,
  );
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "orca");
  assert.match(calls[1], /^codex /);
});
