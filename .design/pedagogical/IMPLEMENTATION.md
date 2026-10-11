# Integrated pedagogical delivery

## Current user direction (2026-10-10)

Implement the complete requested feature set in one working branch, `josiasrfreitas/operacao-pedagogica`, with incremental commits and real browser validation. This supersedes opening one PR as each vertical is implemented.

After the user reviews the complete product experience, split the work into a simple dependency-ordered stack using the installed `gh stack` extension (`github/gh-stack`, v0.1.1). Each PR should target the preceding branch, starting from main. Choose reviewable feature slices without adding unnecessary layers. Do not submit new PRs before that product review.

Previously opened PRs #169 (entry/allocation) and #172 (student profile) remain drafts and are not the final stack. Their work is consolidated here. Refinement of Turmas (#170) continues here too.

The user specifically requests a modern, premium UI; Professores is the current visual reference for Turmas. The individual student page has distinct Pedagógico and Financeiro sections. Occurrences can relate to each other; an intervention groups motivating occurrences that require a teacher's action.

## Delivery constraints

- No local lint, tests, typecheck or build: the user's “sem checks” explicitly means these commands, not browser inspection.
- Preserve commit/push hooks, inspect diffs and validate actual workflows in the browser on desktop and narrow screens.
- Do not mistake placeholders or historical documents for completed product behavior.
- Work items #156, #168, #170 and #171 describe the accepted scope; remaining vertical issues will record concrete implementation choices.

## Consolidated progress

- V1/V2 baseline is on main.
- V3 entry/allocation: main workflows browser-validated; draft implementation consolidated from 2033bf0. Remaining decomposition and CI findings still need resolution.
- Student profile: pedagogical/financial data, payment flow, contact/guardian, list/roster navigation and responsive light/dark UI implemented and browser-validated. Consolidated from aluno-perfil through c215183.
- Turmas visual refinement: implementation pending in this branch.
- V4–V10: implementation pending.

## Additional direction

- Recharts finance analytics (#173) and realistic 250-student seed (#174) implemented in the integrated branch. Academic charts depend on V7 (#175), now in progress.
- Keep only one development server active: the integrated workspace, port 3004. Old root/V3/student servers were stopped and process exit verified on 2026-10-11.
- Product vocabulary is now Leads. The user asks for simple commercial follow-up before a future discussion with sales: fast capture, owner, dated next step and contact history; avoid speculative sales stages, scoring, targets or automated messages.
