# Class records — browser validation

Validated on 11 October 2026 against the integrated workspace, using the public Orca browser CLI and the single web server at `http://operacao-pedagogica.lazuli.localhost` (port 3004). Administrative and teacher sessions used separate browser profiles. The user's tab was not navigated.

## Exercised flows

- **Regular, 21 September, REG 14:00:** completed existing attendance with a page-free review account after exercising required-content validation. Explicit review showed five present students and three absences. Corrected Ana Beatriz's presence and the account with a required reason. Current version 2 contains six present students; the expanded initial revision retains the original attendance and account.
- **PPT, 23 September, PPT 17:30:** entered separate accounts for the seven present students after correcting Daniel's earlier attendance. Missing individual content selected the affected student and focused the field. The first closure required a reason for changing the prior call, preserved that call as version 1 and saved completed content as version 2. A later justified correction marked Eduarda absent; version 3 omits her current account while version 2 retains it.
- **No present students:** the seeded REG 14:00 · 9 encounter rejected a blank observation and focused that field. A justified correction saved the follow-up observation without inventing performed content.
- **Cancelled and future encounters:** the cancelled class displays its reason with no editing form. A 14 October encounter is labelled `Prevista`, exposes the roster preview and explains that recording opens after the scheduled end. The agenda's pending-record filter excludes future encounters.
- **Teacher access:** Camila read her own PPT record and its history without past-date correction controls. Access to another teacher's encounter was denied. Beatriz read the 8 October PPT 16:00 encounter she covered as substitute; the recorded responsible teacher is Beatriz. Current-day teacher writing was not exercised in the browser because the validation date was Sunday and the seeded timetable had no class that day.
- **Activity log:** the actual closures and corrections appear with Clara's name, São Paulo time, encounter date, attendance totals and correction reason. Entries link back to the class record.
- **Layout and keyboard:** inspected desktop light/dark and 390 × 844 mobile light/dark. Mobile had no horizontal page overflow. Selecting a PPT student focuses the corresponding content section. Required fields take focus, the review dialog confirms actual counts, and cancelling a correction restores the current record at the top of its scroll container.

The browser shows the stored planned-versus-performed references. The separate scenario of editing a plan after a class closure, and simultaneous stale class-record submissions, is covered by authored integration cases but was not replayed in the browser. Do not treat authored tests as execution evidence.

## Seed and verification limits

The official complete `pnpm seed` rebuild was applied on 11 October: 250 students, 22 classes, 7 teachers, 220 annual contracts, 61 stage plans and 74 planning snapshots. V4 contributes 87 class records (75 regular, 12 PPT), 89 revisions, two dated substitutions, one cancelled encounter and one encounter without present students. Older attendance-only records remain visibly unfinished for content.

That official rebuild removed the disposable manual V9 validation records. The V9 screenshots and observed flows remain historical evidence; they do not describe the current database. V4 browser mutations described above are also disposable preview data. A read-only count after those flows found 89 records and 95 revisions, with the student count still 250.

Integration coverage was authored for atomic attendance/content, required accounts, no-present notes, cancellation/time bounds, same-day teacher/substitute scope, prior-call preservation, immutable snapshots, stale writes, blocked legacy bypass and absence of academic/financial side effects. A form contract covers content controls and optional page errors. No local tests, lint, typecheck or build were run, following the user's instruction. Commit hooks format staged files and check whitespace. Full automated gates remain for CI.

## Evidence

Screenshots in `evidence/` capture the agenda, regular editor and original revision, PPT history, mobile record/editor, teacher and substitute access in dark mode, and the real activity log. This validates implementation behavior and composition; final product acceptance remains with the user during the integrated review.

## Subsequent V5 validation

The official V5 seed rebuild removed the disposable V4 mutations above. On 11 October, V5 browser QA exercised current-day writing by Camila in a disposable Sunday online encounter: reviewed two declarations, marked one student absent, recorded actual content and confirmed one present/one absent. The remaining link closed atomically with attributed author/time. See `../student-attendance/VALIDATION.md`. This adds browser evidence for current-day teacher writing; concurrent writers and later-plan edits still await CI.
