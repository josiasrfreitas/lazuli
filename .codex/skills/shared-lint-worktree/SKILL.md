---
name: shared-lint-worktree
description: Let two agents resolve different ESLint blocks in one Git worktree, with separate file ownership and durable recovery after context compaction.
---

# Shared lint worktree

Use with [big-lint-resolver](../big-lint-resolver/SKILL.md). Each agent owns **one block**, its files, checks, status file, and commits. There is no general coordinator. Parallel blocks require the owner's authorization and a common baseline recorded in the coordination file.

1. Before editing, including after every context compaction, read `AGENTS.md`, the lint progress, handoff, coordination file, **both** agent status files, `git status --short`, and `git log -1`. Put your block, assigned paths, measured remaining count, and exact next action at the **top of your status file**. Reconcile any mismatch before editing.
2. Edit only paths in your block's frozen inventory. Each agent updates only its own status file after meaningful edits/checks and before ending a turn. Record changed files, targeted error count, check result, and next action. Agree with the other agent and update the coordination file before adding a dependency or test file outside your inventory.
3. Run targeted checks for your block. Keep one heavy check or Git commit active at a time: announce it in your status file and wait if the other agent is checking or committing. Do not use broad `eslint --fix`, repository-wide format writes, or `git add -A`. Stage only your paths and status file, inspect staged paths, and commit atomic slices as `lint (bloco X): descrição`. Do not reset, rebase, or switch branches while the other agent works.
4. Close your block only when its entire targeted area has zero errors, relevant typecheck/tests pass, and its full-workspace lint has no new fingerprints against its baseline. Update your status and the progress document. The agent who finishes second runs the root lint and checks the combined Web/API result; each agent fixes regressions in its own paths. Then select new blocks from that combined snapshot.

The status files are the handoff. If a `/tmp` snapshot disappeared, rerun its documented command and record the new measurement. On resumption, use the files and Git state instead of trusting a conversation summary.
