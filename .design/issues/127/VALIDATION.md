# P11 validation

## Real browser evidence

Captured in the authenticated local application with seeded development data and the real API/Postgres. Names, contacts, and records used for this check are fictional. No API mocks or placeholder e2e outputs were used.

| Viewport   | Before                                                                   | After                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1280 × 800 | [Original Dados step, two-step wizard](evidence/before-desktop-1280.png) | [New Financeiro step](evidence/after-desktop-1280.png), [payer copied and payment preview ready](evidence/after-desktop-ready-1280.png) |
| 375 × 812  | [Original Dados step](evidence/before-mobile-375.png)                    | [Payer and pinned actions](evidence/after-mobile-375.png), [payment preview after scrolling](evidence/after-mobile-payment-375.png)     |

The original wizard had no Financeiro screen, so the before images show its original Dados screen. After images show the new screen, with real financial settings loaded. Mobile captures intentionally show different scroll positions.

### Browser checks

- Desktop is the priority. The rejected custom payer modes/copy buttons were removed; Financeiro now renders `ContractPayerFields` directly, using the existing name search, create option, selected tag, and inline copy logic.
- One inline action copies the guardian when present, otherwise the student. Real guardian copying populated name, phone, and email; selecting the existing payer hid every editable payer detail and the copy action. [Existing payer](evidence/after-desktop-existing-1280.png).
- At 1280 × 800, the default search body is 332/332 pixels (client/scroll height); the copied payer with the complete common preview is 520/520. Both fit without body scrolling. Related date/price fields share row positions and 305-pixel widths; name/document and phone/email use the same two-column layout.
- Opening focuses `fullName`; entering Financeiro focuses the payer search. Enter validates the real form; invalid financial fields receive focus. Back/forward navigation preserves student and financial drafts.
- The required narrow captures document the same final implementation, not a separate mobile design pass. At 375 × 812 the body width is 330/330 pixels (client/scroll width); it scrolls while actions remain visible.
- Preview was checked against the database: zero visual-test students, guardians, and payers existed before saving.
- Completed a minor's registration through the UI. Database check: one student, one guardian, one payer, one contract, one order of 75,000 cents, and two installments of 37,500 cents; no enrollment.
- A real transaction timeout left zero records and kept the entire financial draft. Retrying completed that single set. Unexpected failures use a Portuguese retry message, protected by focused tests.
- Skipped finance with blank financial fields. Database check: the second student had no guardian, contract, or enrollment; payer/guardian totals remained one.
- Existing-payer search and selection were exercised with the payer created above. A real server rejection after changing the isolated database's authorized tuition floor kept the draft and did not create the third student. Original settings were restored. Retrying created exactly one second contract (three installments of 25,000 cents) using the same payer; payer/guardian totals remained one.
- Persistence/error checks preceded the payer layout correction; final screenshots and the targeted tests cover the corrected interaction. The old layout's error screenshot was removed to avoid presenting it as final evidence.

## Automated checks

- `pnpm -F @lazuli/web test`: 151 passing tests. After the payer correction, the two finance test files passed all 12 tests; the existing contract form checks also passed separately (2 tests).
- `pnpm -F @lazuli/validators test`: 135 passing tests.
- Focused API checks in a fresh temporary database: 13 integration and 6 transport tests passed. Included student completion rollback/retry, financial composition, concurrent HTTP submissions, serialization, and unauthorized rejection. The temporary database was removed.
- Migration deploy succeeded in both the temporary database and isolated development database. `pnpm -F @lazuli/db prisma:drift`: no difference detected.
- API, DB, and Web typechecks passed, as did formatting of changed files, focused Web/API/validator lint, the prospective test-quality gate, and whitespace checks. A later combined lint rerun was stopped when the shared machine and Postgres stalled; full lint remains a CI gate. Test quality had zero blocking errors; contextual warnings are deterministic loops over named cases and explicit skip/contract branches, reviewed against the testing guide.
- CI owns full repository lint/typecheck, duplication, production build, all test tiers, scripts/styles, and migration gates. Those broader gates run in CI to avoid competing with other worktrees on this shared local machine. The PR is monitored in this same session until its checks settle.

## Scope check

The financial operation remains behind `finance(db, staffUserId)`. The new admin-only student coordinator composes existing operations in one transaction. Nullable command metadata protects both skip and contract retries without rewriting historical students. Turma enrollment and the existing Pedagógico placeholder remain outside P11.

## PR follow-up

- Initial static CI found the completion hook exceeded the 50-line function limit. Extracted its creation/rejection handlers into one hook with unchanged mutation behavior; verified focused lint and typecheck before pushing.

- User correction: replaced custom payer controls with the actual existing contract component, tightened desktop spacing, and recaptured final real screenshots. Focused lint (zero errors), Web typecheck, and financial tests passed.
