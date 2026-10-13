# Student profile — #171

The user added an individual student page with pedagogical and financial sections and requested a modern, premium interface. During the integrated review on 2026-10-13, they selected an editorial premium direction and explicitly limited this round to desktop.

Direction: a compact identity header with inline navigation, full-width content, a current-stage composition with attendance and the overall grade mean, and an integrated surface for appointments and pedagogical follow-up. Contact details live in the overview footer, with the complete record in a shared Sheet. Finance prioritizes overdue actions, actual payment progress, and payment behavior. Existing semantic tokens, typefaces, badges, tables, and controls support both themes.

Data contract: pedagogical reads are scoped to the exact student, use civil enrollment windows and the established attendance calculation. Finance scopes the existing ledger before totals, grouping and pagination, including contract and beneficiary links. Shared-payer orders for other students must not leak into the profile. Existing admin authorization is retained.

- [x] Route and active profile link from the students preview and class roster.
- [x] Real pedagogical and financial data, explicit empty/loading/error states.
- [x] Payment action composes the existing payment flow.
- [x] Validate real browser flows, narrow layout and both themes.
- [x] Inspect complete diff and commit incrementally.

No local lint, tests, typecheck or build per the user's explicit instruction. Integration coverage authored for the changed query contracts; execution left to CI. Commit/push hooks retained.

## Integrated review — 2026-10-13

Implemented in `josiasrfreitas/operacao-pedagogica`, starting from `0446f1a`, in the existing isolated worktree and database. The user invoked frontend-design and Impeccable craft, bolder, and polish. Their latest instructions supersede the original contact sidebar, separate tab row, and narrow-layout validation target.

- The header contains the name, status, contact actions, and section tabs. The decorative gold rule below the name was removed at the user's request.
- Enrollment format and modality are metadata beneath the stage title. The teaching-plan link sits with the enrollment context; the stage journey expands in place.
- The current-stage mean includes every recorded grade, including recovery, and excludes missing grades. It remains tied to the current stage when the assessment selector shows an older stage. Academic approval rules remain separate.
- Assessments show the graph beside the existing result table. The default Y-axis follows the recorded range, with a minimum 20-point span, explicit range caption, and a full 0–100 toggle. The approval reference is drawn only when it falls inside the displayed range.
- Competence badges match the chart series: Oral blue, Listening green, Written amber, and Participação purple. This is an explicitly requested categorical use of the existing Badge palette, independent of the separate result/status column. No new palette was added.
- User-facing assessment language now uses “Unidade 1” and “Unidade 2”; persisted phase identifiers are unchanged. “Concluir avaliação”, “Registrar aprovação”, and “Registrar repetência” name the actual decisions.
- Appointments use date anchors and visible status; upcoming appointments precede completed ones. Frequency-contact notes have readable text, channel, author, date, and follow-up date. Active interventions expose the next step and overdue review date alongside recent occurrences.
- Finance opens with overdue installments, oldest first, with the first receive action emphasized. Paid progress uses received money, including partial receipts, divided by received money plus the current collectible balance.
- Payment behavior uses the receipt that completes each adjusted installment amount. Recurrence counts distinct due months with late settlements or current overdue balances. The average delay includes settled late installments only. Summary values are calculated over all student-scoped ledger rows, independent of pagination.
- Contract duration, actual installment schedule, due day, term, and punctuality discount appear discreetly below the overview. The detailed link opens Recebíveis with `aluno=<studentId>`; clearing that filter returns to the complete ledger.

### Populated local example

[João Pedro Fontes Azevedo](http://operacao-pedagogica.lazuli.localhost/alunos/ed109528-32f1-1f06-fb75-381bb3ad838f) is the populated review example. Only the isolated local database was modified; no reseed, schema change, or external communication occurred.

- Current Essentials 2, previous Essentials 1, and a scheduled enrollment for 2027.1.
- Eight current grades, mean **84.25**. Unit 2 was entered and saved through the actual browser form. The original Unit 1 values were preserved.
- Attendance **95%**, 27 presences over 29 sessions, 135 missing minutes, and 45 compensated minutes.
- Three appointments: an attended makeup, attended PPT complement, and a scheduled makeup on 2026-10-16. Two frequency contacts, three existing occurrences, and one intervention in progress with an overdue review.
- Address, guardian, contact channels, and demonstration notes populated.
- Annual contract: 12 installments of R$250, due on day 5, 10% punctuality discount. A local material order adds six installments of R$120, including on-time, late, partial, overdue, and future examples.
- At the review date: **R$1,305 received**, **R$2,315 outstanding**, **36% paid**. Two overdue balances total **R$195**: R$75 remaining from September after R$45 received, and R$120 from October. Five installments settled on time and two late; average late settlement delay is eight days.

These additions are local review data, not changes to the official seed. Reseeding would remove them. Dates and overdue ages change with the school calendar.

### Visual and interaction evidence

Inspected the complete populated page in the Orca browser, including the lower support/history sections, at desktop widths 1280, 1440, and 1920. Light and dark themes were reviewed; the 1280 page had no document overflow.

- Saved Unit 2, observed the mean and chart refresh, and selected the previous stage while the hero retained 84.25.
- Exercised cropped/full chart scale, metric popover, stage-journey disclosure, and teaching-plan destination parameters.
- Opened and cancelled grade, assessment-decision, frequency-contact, and receipt forms. The oldest partial installment opened with the correct R$75 balance. No new financial receipt or academic decision was submitted in this visual pass.
- Opened the complete contact Sheet; Escape closed it and returned focus to its trigger. Arrow keys moved section-tab focus; Enter activated the focused tab, and Tab entered its panel.
- Finance filters displayed 18 total installments, seven paid installments, and two pending installments. Recebíveis opened with exactly 18 scoped rows; clearing the student filter removed the URL parameter.
- Reviewed Alice Santana Costa's punctual-payment state and Gabriela Rocha Moreira's no-enrollment/no-charge state. No fake grade, attendance percentage, or payment history was inserted into empty UI states.
- The final browser console sample contained log/info messages only. Full keyboard, screen-reader, and transport failure coverage was not attempted.

Evidence: [pedagogy dark](student-pedagogy-desktop-dark.png), [pedagogy light at 1280](student-pedagogy-desktop-1280.png), [support and history](student-support-desktop-dark.png), [finance dark](student-finance-desktop-dark.png), [finance light](student-finance-desktop-light.png).

The complete implementation diff was inspected. No manual code checks, lint, typecheck, build, or test suites were run, as explicitly requested. An earlier-authored mean unit test remains unexecuted. Commit formatting/whitespace hooks are retained; broader code verification remains for CI. Browser evidence demonstrates the exercised states, not final user approval.

## Original browser evidence — 2026-10-10

Validated in the isolated `aluno-perfil` worktree with its seeded database and real magic-link login, on 2026-10-10 (school date).

- Alice Barbosa Costa: stage Connect 1, regular in-person class, Mon/Wed 14:00–15:30, 26 presences over 29 confirmed sessions (90%). Contact and guardian loaded from the student record.
- Financial: 12 installments, initially 2 overdue and 4 paid. Received the August installment through the existing dialog (R$213.20 including interest), using Enter from the initially focused date field. Overdue decreased to 1, paid increased to 5; reload retained the result. Escape closed the dialog without submitting in the preceding attempt.
- All/overdue/paid filters, pedagogical/financial tabs, direct URL reload and return to the filtered students list exercised. ArrowRight moved focus between section tabs; Tab entered the active panel.
- Created Lívia Andrade through the real student creation flow with no enrollment or contract. Both sections presented explicit empty states and missing contact data; no invented attendance or balance.
- Missing student ID displayed the existing not-found error with retry and list-return actions.
- Screenshots: light/dark 1440 px, light 1280 px, narrow 390 px; document width equals viewport width at 390 px. Operational tables scroll within their own viewport. Payment form inspected at 390 px.
- No local lint, test suite, typecheck or build. Commit hooks formatted staged code and checked whitespace; push hook parsed committed files and enforced component size.

PR: https://github.com/josiasrfreitas/lazuli/pull/172
