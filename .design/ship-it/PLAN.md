# ship-it implementation plan

## Goal

One command accepts an issue number and drives planning, implementation, PR creation,
and PR monitoring from an Orca-managed worktree. GPT-6 Sol with low reasoning is the
default; flags override both settings.

## Sequence

1. Find the local `main` checkout. Reject uncommitted changes, fetch `origin/main`,
   fast-forward, and verify identical heads.
2. Validate the GitHub issue and create an Orca worktree linked to it.
3. Start one Codex session in YOLO mode. It writes a structured plan in
   `.design/issues/<id>/PLAN.md`.
4. In that same session, Codex implements, tests, captures real UI evidence when
   applicable, opens a PR, and uses `babysit-pr` until CI settles.
5. After Codex exits, verify the PR and PR checks before success.

## Contract and evidence

A stale or dirty `main` must never lead to an Orca worktree. Script tests use
a real temporary Git remote and fake external CLIs to verify ordering and model
arguments. `bash -n`, script tests,
formatting, and diff checks validate the change.

## Constraint

The installed Orca CLI manages worktrees but has no pull command. Git updates the
Orca-managed `main` checkout before Orca creates the issue worktree. The script
stops when Orca or Codex returns an error; it does not merge PRs.
