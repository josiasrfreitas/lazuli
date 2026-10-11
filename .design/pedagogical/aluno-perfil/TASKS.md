# Student profile — #171

The user added an individual student page with pedagogical and financial sections and requested a modern, premium interface. This is an autonomous implementation direction, not a recorded workshop selection.

Direction: restrained typography and strong hierarchy; persistent identity and contact; two accessible page tabs; one current-enrollment composition with attendance, schedule and stage journey; financial ledger through the existing operational-table and payment primitives. Existing semantic tokens support both themes.

Data contract: pedagogical reads are scoped to the exact student, use civil enrollment windows and the established attendance calculation. Finance scopes the existing ledger before totals, grouping and pagination, including contract and beneficiary links. Shared-payer orders for other students must not leak into the profile. Existing admin authorization is retained.

- [x] Route and active profile link from the students preview and class roster.
- [x] Real pedagogical and financial data, explicit empty/loading/error states.
- [x] Payment action composes the existing payment flow.
- [x] Validate real browser flows, narrow layout and both themes.
- [x] Inspect complete diff and commit incrementally.

No local lint, tests, typecheck or build per the user's explicit instruction. Integration coverage authored for the changed query contracts; execution left to CI. Commit/push hooks retained.

## Browser evidence

Validated in the isolated `aluno-perfil` worktree with its seeded database and real magic-link login, on 2026-10-10 (school date).

- Alice Barbosa Costa: stage Connect 1, regular in-person class, Mon/Wed 14:00–15:30, 26 presences over 29 confirmed sessions (90%). Contact and guardian loaded from the student record.
- Financial: 12 installments, initially 2 overdue and 4 paid. Received the August installment through the existing dialog (R$213.20 including interest), using Enter from the initially focused date field. Overdue decreased to 1, paid increased to 5; reload retained the result. Escape closed the dialog without submitting in the preceding attempt.
- All/overdue/paid filters, pedagogical/financial tabs, direct URL reload and return to the filtered students list exercised. ArrowRight moved focus between section tabs; Tab entered the active panel.
- Created Lívia Andrade through the real student creation flow with no enrollment or contract. Both sections presented explicit empty states and missing contact data; no invented attendance or balance.
- Missing student ID displayed the existing not-found error with retry and list-return actions.
- Screenshots: light/dark 1440 px, light 1280 px, narrow 390 px; document width equals viewport width at 390 px. Operational tables scroll within their own viewport. Payment form inspected at 390 px.
- No local lint, test suite, typecheck or build. Commit hooks formatted staged code and checked whitespace; push hook parsed committed files and enforced component size.

PR: https://github.com/josiasrfreitas/lazuli/pull/172
