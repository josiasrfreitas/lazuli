---
name: big-lint-resolver
description: Resolve a large ESLint backlog in fixed batches of about 100 errors, with full-repository regression checks and a durable handoff record between batches.
---

# Big lint resolver

Use this workflow when the owner asks to reduce a large lint backlog incrementally. Work locally unless the owner gives separate publication instructions. Run one check at a time. Do not run ESLint `--fix` unless the owner requests it.

1. Read the active progress document before editing. Its first lines must state the **locked batch**, its original error count, the latest remaining count, the exact lint command and snapshot, and the next completion gate. If the document does not exist, create it from a full lint inventory before choosing a batch. In every context handoff, put that same lock and gate at the top of the summary.
2. Freeze roughly 100 errors from one full lint result, grouped by a coherent area or dependent files. Record the selected files and error counts in the progress document. Resolve only that batch. Run targeted lint after each meaningful group of edits and update the measured remaining count. Keep fixes semantic: preserve behavior, review the diff, and do not weaken rules or add suppressions just to lower the count.
3. The batch is closed only when targeted lint over its **entire recorded area** reports zero errors. Run relevant type checks and tests for the changes. Then run `pnpm lint` from the repository root and capture machine-readable ESLint results for failing workspaces. Compare the new full result with the preceding full snapshot by file, rule and message, as well as by total; a lower total can still hide new errors. Investigate new errors before advancing and distinguish concurrent edits from the batch's changes.
4. Record the full result, resolved batch, new errors and their cause in the progress document. Choose the next roughly 100 errors from **that same full result**, prioritizing any regressions, and lock the next batch before editing it. Repeat locally until the requested backlog is cleared or the owner changes scope.

The progress document is the durable handoff source. A temporary JSON path is supporting evidence, not the only record: preserve the active file list, counts, command and gate in the document so a reboot or context compaction cannot silently change the batch.

When the owner explicitly authorizes separate agents to work on different blocks in parallel, record the shared baseline, disjoint paths, and independent status/gates for each block before editing. Each agent closes its own block; after both are ready, compare the combined full lint result before selecting further work. Use [shared-lint-worktree](../shared-lint-worktree/SKILL.md) when they share one worktree.
