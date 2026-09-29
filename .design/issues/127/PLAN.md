# P11 — Concluir Novo aluno com contrato opcional

## Scope

- Add a Finance step to Novo aluno after Dados and the existing Pedagógico placeholder. Skipping Finance creates only the student; completing it creates the student, payer, contract, order, and installments atomically.
- Keep the draft through back/forward navigation and failed submissions. Preview never persists.
- Keep class enrollment outside this issue. Do not change applied migrations or historical identifiers.

## Decisions and dependencies

- P06 and P07 are closed and their payer creation, payment-plan fields, domain preview, and contract command are present. Reuse these rather than duplicate financial rules.
- The beneficiary is `newStudent` in the existing contract command, with no student ID in the client draft. The server transaction already wraps student, payer, and contract creation. Retain a stable command ID for retry.
- Both paths use `students.completeCreation`, wrapping the existing student and finance operations. Persist nullable command metadata on Student so retries of skipped finance are safe too, including concurrent submissions and lost responses. A command reused with changed contents is a conflict. Add one compatible migration; existing students are not rewritten.
- Command IDs have one owner across student completion and direct contract creation. Serialize the same identity inside the transaction, reject cross-endpoint reuse, and retain identical replay in its original operation.
- Finance remains behind `finance(db, staffUserId)` and admin procedures.
- Use the current design tokens and pt-BR labels; business dates use America/Sao_Paulo.
- Latest user refinement: reuse `ContractPayerFields` and `PayerCopyButton` directly. Start with the existing name search; create within its options; show only a tag for an existing payer. One inline copy action explicitly copies the guardian when present, otherwise the student. Prioritize desktop alignment and efficient use of space.
- Follow `docs/frontend/forms.md` and `Patterns/DenseForm`: real form and Enter submit, named groups, compact related fields, masked dates, conditional payer details, first-error focus, and a scroll-free default desktop state.

## Files

- `apps/web/src/features/students/new-student/*`: reducer, input conversion, steps, footer, and dialog submission.
- `apps/web/src/features/contracts/*`: reuse or extract the payer and payment-plan controls where needed.
- `apps/web/src/features/students/new-student/completion.ts`: coordinate the two submission paths and invalidate student, contract, and party queries.
- `packages/api/src/creation-command.ts`: transaction lock and shared command ownership checks.
- `packages/api/src/students/completion.ts` and `router.ts`: compose existing public operations inside one transaction and recover identical retries.
- `packages/validators/src/student-completion.ts`: validate mutually exclusive skip/contract inputs and require a new beneficiary.
- `packages/db/prisma/schema.prisma` and one new migration: nullable unique command identity and fingerprint on Student; no changes to existing records.
- Relevant unit, integration, and transport tests; this plan and committed screenshots.

## Test contract

- Contract: skip persists only student; completion persists the whole set; failure rolls it all back; retry creates one set; preview writes nothing; back/forward preserves typed values.
- Plausible defects: stale IDs, partial writes, duplicated retry, lost draft, and preview accidentally invoking a mutation.
- Oracle: issue #127 acceptance and the transaction/command identity contract from P05–P07, independent of component implementation.
- Test at the cheapest meaningful tiers: reducer/input unit, database rollback/retry integration, and transport composition/authorization; manually traverse the real UI.

## Validation and visual evidence

- Run focused tests and proportionate format, lint, typecheck, build, and test gates. Inspect the complete diff and run `git diff --check`.
- Capture a real before state and after states at desktop 1280×800 and a narrow viewport. Commit images under `.design/issues/127/evidence/` and link them in the PR. Check loading/error/empty states and keyboard access where applicable.
- Open a PR with the installed template, then use `babysit-pr` in this session until checks are stably green and delivered feedback is handled. Never merge.

## Plan recheck

- Rechecked against issue #127, its P05–P07 dependencies, `AGENTS.md`, the financial decisions, `docs/testing/README.md`, and `docs/frontend/forms.md` before implementation.
- The user explicitly reinstated Finance and refined the payer interaction. The first custom payer choice UI was rejected. Use the existing contract form interaction and its conditional copy source; only pressing copy creates a payer draft. Existing-payer selection hides its details.
- Inspection showed contract retries were already protected, while skipped finance used ordinary student creation. The unified coordinator and compatible command metadata close that gap for both submission paths.
