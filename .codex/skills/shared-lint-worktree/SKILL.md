---
name: shared-lint-worktree
description: Let two agents resolve separate parts of a locked ESLint batch in one Git worktree without losing file ownership or progress after context compaction.
---

# Shared lint worktree

Use with [big-lint-resolver](../big-lint-resolver/SKILL.md). That skill owns the batch and regression gate. Here, **each agent owns its own half**; there is no general coordinator.

1. Before editing, including after every context compaction, read `AGENTS.md`, the active lint progress and handoff, the coordination file, both agent status files, `git status --short`, and `git log -1`. Put your assigned files, measured remaining count, and exact next action at the **top of your status file**. Reconcile any mismatch before editing.
2. Edit only your assigned source/test paths. Each agent writes only its own status file. Record changed files, targeted lint count, check result, and next action after meaningful progress and before ending a turn. To change ownership or add a dependency/test file, agree with the other agent and update the coordination file before editing it.
3. Run targeted checks for your half. Keep one heavy check or Git commit active at a time: announce it in your status file and wait if the other agent is checking or committing. Do not use broad `eslint --fix`, repository-wide format writes, or `git add -A` in the shared worktree. Stage only your paths and status file; check the staged path list before committing `lint (bloco X): descrição`. Do not reset, rebase, or switch branches while the other agent works.
4. When your half has zero targeted lint errors, relevant typecheck/tests pass, and your diff is reviewed, mark it **ready** in your status file. The agent who finishes second runs the lint over the entire frozen batch, the full lint and fingerprint comparison required by `big-lint-resolver`, and updates the shared progress. Both agents fix any regressions in their own paths. Only after that gate may either agent begin the next batch.

The status files are the handoff. If a `/tmp` snapshot disappeared, rerun its documented command and record the new measurement. On resumption, use the files and Git state instead of trusting a conversation summary.
