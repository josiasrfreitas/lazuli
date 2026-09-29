# P11 validation

## Real browser evidence

Captured in the authenticated local application with seeded development data and the real API/Postgres. Names, contacts, and records used for this check are fictional. No API mocks or placeholder e2e outputs were used.

| Viewport   | Before                                                                   | After                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1280 × 800 | [Original Dados step, two-step wizard](evidence/before-desktop-1280.png) | [New Financeiro step](evidence/after-desktop-1280.png), [payer copied and payment preview ready](evidence/after-desktop-ready-1280.png) |
| 375 × 812  | [Original Dados step](evidence/before-mobile-375.png)                    | [Payer and pinned actions](evidence/after-mobile-375.png), [payment preview after scrolling](evidence/after-mobile-payment-375.png)     |

The original wizard had no Financeiro screen, so the before images show its original Dados screen. After images show the new screen, with real financial settings loaded. Mobile captures intentionally show different scroll positions.

### Browser checks

- Opening focuses `fullName`; entering Financeiro focuses `payerName`.
- Enter advances from Dados and validates Financeiro. Invalid payer/dates focus the payer field; an invalid advanced quantity focuses `installmentCount`.
- Tab walk with collapsed contacts: Novo pagador → Copiar aluno → Copiar responsável → payerName → payerDocumentNumber → Adicionar → agreedOn → firstDueDate → endsOn → monthlyAmount → Parcelamento avançado → Voltar → Pular e criar aluno → Concluir com contrato → Fechar. Each date takes one stop.
- Desktop default body: `scrollHeight = clientHeight = 398`. With a complete common-plan preview and collapsed contacts: both 490. No desktop body scroll in either state.
- Narrow viewport: page width 375; body `scrollWidth = clientWidth = 330`; stepper `scrollWidth = clientWidth = 293`. All three step labels fit. Header/footer stay visible while the body scrolls.
- Explicit student and guardian copy actions copy the selected name and contacts. Switching payer modes and navigating Financeiro → Pedagógico → Dados → Financeiro preserve both drafts. Recolher hides contacts without discarding them.
- Preview was checked against the database: zero visual-test students, guardians, and payers existed before saving.
- Completed a minor's registration through the UI. Database check: one student, one guardian, one payer, one contract, one order of 75,000 cents, and two installments of 37,500 cents; no enrollment.
- A real transaction timeout left zero records and kept the entire financial draft. Retrying completed the single set above. Unexpected failures now use a Portuguese retry message; focused tests protect that mapping, and a later real failure confirmed the [message with the draft intact](evidence/after-desktop-error-1280.png).
- Skipped finance with blank financial fields. Database check: the second student had no guardian, contract, or enrollment; payer/guardian totals remained one.
- Existing-payer search and selection were exercised with the payer created above. A real server rejection after changing the local authorized tuition floor kept the draft and did not create the third student. Original settings were restored.

## Automated checks

- `pnpm -F @lazuli/web test`: 151 passing tests. After adding error-message protection, the two finance test files passed all 10 tests.
- `pnpm -F @lazuli/validators test`: 135 passing tests.
- Focused API checks in a fresh temporary database: 13 integration and 6 transport tests passed. Included student completion rollback/retry, financial composition, concurrent HTTP submissions, serialization, and unauthorized rejection. The temporary database was removed.
- Migration deploy succeeded in both the temporary database and isolated development database. `pnpm -F @lazuli/db prisma:drift`: no difference detected.
- API, DB, and Web typechecks passed, as did formatting of changed files, focused Web/API/validator lint, the prospective test-quality gate, and whitespace checks. A later combined lint rerun was stopped when the shared machine and Postgres stalled; full lint remains a CI gate. Test quality had zero blocking errors; contextual warnings are deterministic loops over named cases and explicit skip/contract branches, reviewed against the testing guide.
- CI owns full repository lint/typecheck, duplication, production build, all test tiers, scripts/styles, and migration gates. Those broader gates run in CI to avoid competing with other worktrees on this shared local machine. The PR is monitored in this same session until its checks settle.

## Scope check

The financial operation remains behind `finance(db, staffUserId)`. The new admin-only student coordinator composes existing operations in one transaction. Nullable command metadata protects both skip and contract retries without rewriting historical students. Turma enrollment and the existing Pedagógico placeholder remain outside P11.
