import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const script = path.resolve("scripts/ship-it.sh");

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ship-it-"));
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "main");
  const writer = path.join(root, "writer");
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  run("git", ["init", "--bare", "-b", "main", remote]);
  run("git", ["clone", remote, main]);
  run("git", ["-C", main, "config", "user.email", "test@example.com"]);
  run("git", ["-C", main, "config", "user.name", "Test"]);
  writeFileSync(path.join(main, "file"), "initial\n");
  run("git", ["-C", main, "add", "file"]);
  run("git", ["-C", main, "commit", "-m", "initial"]);
  run("git", ["-C", main, "push", "origin", "main"]);
  run("git", ["clone", remote, writer]);
  run("git", ["-C", writer, "config", "user.email", "test@example.com"]);
  run("git", ["-C", writer, "config", "user.name", "Test"]);
  writeFileSync(path.join(writer, "file"), "updated\n");
  run("git", ["-C", writer, "commit", "-am", "updated"]);
  run("git", ["-C", writer, "push", "origin", "main"]);
  const log = path.join(root, "calls");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SHIP_TEST_MAIN: main,
    SHIP_TEST_ROOT: root,
    SHIP_TEST_LOG: log,
  };
  writeFileSync(
    path.join(bin, "gh"),
    `#!/bin/bash
if [[ "$1 $2" == "repo view" ]]; then echo owner/repo; elif [[ "$1 $2" == "issue view" ]]; then echo 123; else echo https://github.com/owner/repo/pull/42; fi
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(bin, "orca"),
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
    path.join(bin, "codex"),
    `#!/bin/bash
printf 'codex\\n' >> "$SHIP_TEST_LOG"
printf '%s' "$*" > "$SHIP_TEST_ROOT/codex-args"
printf 'STATUS: %s\\n1. Implement and test.\\n' "\${SHIP_TEST_PLAN_STATUS:-READY}" > "$SHIP_TEST_ROOT/issue-123/.design/issues/123/PLAN.md"
`,
    { mode: 0o755 },
  );
  return { main, log, env };
}

test("updates main before Orca creates a worktree and passes model settings to one Codex session", () => {
  const { main, log, env } = fixture();
  run("bash", [script, "123", "--model", "gpt-6-astra", "--effort", "high"], { cwd: main, env });
  assert.equal(readFileSync(path.join(main, "file"), "utf8"), "updated\n");
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "orca");
  const args = readFileSync(path.join(env.SHIP_TEST_ROOT, "codex-args"), "utf8");
  assert.match(args, /--dangerously-bypass-approvals-and-sandbox/);
  assert.match(args, /--model gpt-6-astra/);
  assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.match(args, /THIS SAME SESSION/);
  assert.match(args, /babysit-pr/);
});

test("refuses a dirty main before calling Orca or Codex", () => {
  const { main, log, env } = fixture();
  writeFileSync(path.join(main, "file"), "dirty\n");
  assert.throws(
    () => run("bash", [script, "123"], { cwd: main, env, stdio: "pipe" }),
    /Main worktree is dirty/,
  );
  assert.throws(() => readFileSync(log), { code: "ENOENT" });
});

test("rejects a blocked plan after the Codex session returns", () => {
  const { main, log, env } = fixture();
  env.SHIP_TEST_PLAN_STATUS = "BLOCKED";
  assert.throws(
    () => run("bash", [script, "123"], { cwd: main, env, stdio: "pipe" }),
    /Plan is blocked/,
  );
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "orca");
  assert.equal(calls[1], "codex");
});
