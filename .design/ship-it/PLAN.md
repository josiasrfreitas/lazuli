# ship-it implementation plan

## Goal

One command accepts an issue number and drives planning, implementation, PR creation,
and PR monitoring from an Orca-managed worktree. GPT-6 Sol with low reasoning is the
default; flags override both settings.

## Sequence

1. Find the local `main` checkout. Reject uncommitted changes, fetch `origin/main`,
   fast-forward, and verify identical heads.
2. Validate the GitHub issue and create an Orca worktree linked to it.
3. Run Codex to write a structured plan in `.design/issues/<id>/PLAN.md`. Stop on a
   blocked or malformed plan.
4. Run Codex to implement, test, capture real UI evidence when applicable, and open
   a PR using the repository's PR template.
5. Run Codex with `babysit-pr` until CI settles; verify PR checks before success.

## Contract and evidence

A stale or dirty `main` must never lead to an Orca worktree. A blocked plan must
never enter implementation. Script tests use a real temporary Git remote and fake
external CLIs to verify ordering and model arguments. `bash -n`, script tests,
formatting, and diff checks validate the change.

## Constraint

The installed Orca CLI manages worktrees but has no pull command. Git updates the
Orca-managed `main` checkout before Orca creates the issue worktree. The script
stops when Orca or Codex returns an error; it does not merge PRs.
