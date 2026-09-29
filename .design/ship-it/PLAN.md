# ship-it implementation plan

## Goal

One command accepts an issue number and drives planning, implementation, PR creation,
and PR monitoring from an Orca-managed worktree. GPT-6 Sol with low reasoning is the
default; flags override both settings.

## Sequence

1. Find the local `main` checkout. Reject uncommitted changes, fetch `origin/main`,
   fast-forward, and verify identical heads.
2. Validate the GitHub issue and create an Orca worktree linked to it.
3. Open one interactive Codex terminal in Orca in YOLO mode and send one prompt.
   Codex writes a structured plan in `.design/issues/<id>/PLAN.md`.
4. In that same session, Codex implements, tests, captures real UI evidence when
   applicable, opens a PR, and uses `babysit-pr` until CI settles.
5. Return the Orca terminal handle after the prompt is accepted. Codex remains
   active in that terminal until its PR work is settled.

## Contract and evidence

A stale or dirty `main` must never lead to an Orca worktree. Script tests use
a real temporary Git remote and fake external CLIs to verify ordering and model
arguments and prompt delivery. `bash -n`, script tests, formatting, and diff
checks validate the change.

## Constraint

The installed Orca CLI manages worktrees but has no pull command. Git updates the
Orca-managed `main` checkout before Orca creates the issue worktree. The script
stops if Orca cannot start or accept the Codex prompt; it does not merge PRs.
