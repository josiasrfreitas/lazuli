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
if [[ "$1 $2" == "worktree create" ]]; then
  [[ "$(git -C "$SHIP_TEST_MAIN" rev-parse HEAD)" == "$(git -C "$SHIP_TEST_MAIN" rev-parse origin/main)" ]] || exit 27
  printf 'worktree\\n' >> "$SHIP_TEST_LOG"
  git -C "$SHIP_TEST_MAIN" worktree add -q -b issue-123 "$SHIP_TEST_ROOT/issue-123"
  printf '{"ok":true,"result":{"worktree":{"id":"repo-test::%s","path":"%s"}}}\\n' "$SHIP_TEST_ROOT/issue-123" "$SHIP_TEST_ROOT/issue-123"
elif [[ "$1 $2" == "terminal create" ]]; then
  printf 'terminal-create\\n' >> "$SHIP_TEST_LOG"
  printf '%s' "$*" > "$SHIP_TEST_ROOT/terminal-create-args"
  echo '{"ok":true,"result":{"terminal":{"handle":"term-test"}}}'
elif [[ "$1 $2" == "terminal wait" ]]; then
  printf 'terminal-wait\\n' >> "$SHIP_TEST_LOG"
  if [[ "\${SHIP_TEST_NEVER_READY:-}" == 1 || ! -e "$SHIP_TEST_ROOT/waited" ]]; then
    touch "$SHIP_TEST_ROOT/waited"
    echo '{"ok":false,"error":{"code":"timeout","message":"timeout"}}'
    exit 1
  fi
  echo '{"ok":true,"result":{"wait":{"satisfied":true}}}'
elif [[ "$1 $2" == "terminal read" ]]; then
  printf 'terminal-read\\n' >> "$SHIP_TEST_LOG"
  if [[ "\${SHIP_TEST_NEVER_READY:-}" == 1 ]]; then
    echo '{"ok":true,"result":{"terminal":{"tail":["Starting Codex"]}}}'
  else
    echo '{"ok":true,"result":{"terminal":{"tail":["› Ask Codex to do anything"]}}}'
  fi
elif [[ "$1 $2" == "terminal send" ]]; then
  printf 'terminal-send\\n' >> "$SHIP_TEST_LOG"
  printf '%s' "$*" > "$SHIP_TEST_ROOT/terminal-send-args"
  echo '{"ok":true,"result":{"send":{"accepted":true}}}'
else
  exit 28
fi
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(bin, "codex"),
    `#!/bin/bash
printf 'direct-codex\\n' >> "$SHIP_TEST_LOG"
exit 29
`,
    { mode: 0o755 },
  );
  return { main, log, env };
}

test("updates main, opens one interactive Codex terminal, then sends the prompt", () => {
  const { main, log, env } = fixture();
  run("bash", [script, "123", "--model", "gpt-6-astra", "--effort", "high"], { cwd: main, env });
  assert.equal(readFileSync(path.join(main, "file"), "utf8"), "updated\n");
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.deepEqual(calls, [
    "worktree",
    "terminal-create",
    "terminal-wait",
    "terminal-read",
    "terminal-send",
  ]);
  const launch = readFileSync(path.join(env.SHIP_TEST_ROOT, "terminal-create-args"), "utf8");
  assert.match(launch, /--worktree id:repo-test::/);
  assert.match(launch, /--command codex --model gpt-6-astra/);
  assert.match(launch, /--focus/);
  assert.match(launch, /model_reasoning_effort=.*high/);
  assert.match(launch, /--dangerously-bypass-approvals-and-sandbox/);
  assert.doesNotMatch(launch, /codex exec/);
  const sent = readFileSync(path.join(env.SHIP_TEST_ROOT, "terminal-send-args"), "utf8");
  assert.match(sent, /--terminal term-test/);
  assert.match(sent, /--enter --wait-submit 10/);
  assert.match(sent, /THIS SAME SESSION/);
  assert.match(sent, /\$ship-with-tests/);
  assert.match(sent, /\$pr/);
  assert.match(sent, /\$babysit-pr/);
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

test("does not send the prompt before Codex is ready", () => {
  const { main, log, env } = fixture();
  env.SHIP_TEST_NEVER_READY = "1";
  assert.throws(
    () => run("bash", [script, "123"], { cwd: main, env, stdio: "pipe" }),
    /Codex TUI did not become ready/,
  );
  assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), [
    "worktree",
    "terminal-create",
    "terminal-wait",
    "terminal-read",
    "terminal-wait",
  ]);
  assert.throws(() => readFileSync(path.join(env.SHIP_TEST_ROOT, "terminal-send-args")), {
    code: "ENOENT",
  });
});
