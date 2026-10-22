# V9 browser validation — 11 October 2026

Issue: #180. Integrated workspace, one web server at http://operacao-pedagogica.lazuli.localhost.

## Observed workflows

- The official `pnpm seed` rebuilt only the isolated workspace database/bucket: 250 students, 22 classes, 7 teachers, 220 annual contracts, 61 plans, 984 active activities, three withdrawn activities and 74 immutable snapshots. V10 returned to its official 38 occurrences/six interventions; earlier manual QA entries were removed by this reset.
- PPT: Arthur Menezes Campos initially had 13 activities and an expired 15 August target. Administration revised the deadline to 30 November, added a page-free oral review and moved it from 20 to 22 October with a required reason. Version 1 still shows the original deadline and 13 activities; the current plan is version 4 with 14 activities.
- Empty activity title produced an inline error and focus; Enter submitted actual forms. Editing/removing an activity requires a reason. Date fields use the Brazilian mask. The default desktop dialog was inspected at 1280×800.
- Regular: attempting a deadline in January 2027 for semester 2026.2 was rejected. Created a real REG 07:00 class for Camila, then its initially empty plan. Adding and withdrawing an activity retained that activity in the earlier snapshot.
- Two real browser tabs: an administrator opened a version-1 window form, then the second tab added an activity and created version 2. Saving the stale first form returned the conflict message, preserved the draft, retained the newer activity and kept the 31 December deadline. The temporary second tab was closed.
- In a separate authenticated profile, Camila added a page-free activity to her class; the resulting version identifies Camila and business date/time. Another teacher's class returned the responsibility error on direct navigation.
- Natália Lacerda Barbosa's student profile links to the closed Essentials 1 plan, labelled historical and without editing controls. Her current Essentials 2 link opens the distinct individual plan beginning 4 October and ending 17 February 2027.
- Paused Arthur's current enrollment through the class roster, then returned him to the same class/stage through the real return dialog. The current student link still opens version 4, 14 activities and the unchanged 30 November target. Earlier enrollment links remain available in the student history.
- The activity timeline displays attributed planning changes by Clara and Camila, together with seeded revisions. The history query initially rejected tRPC's `direction` metadata; accepting that optional transport field fixed the real version-history flow.
- Inspected desktop light/dark and 390×844 layouts. Mobile document/main widths equal 390 px; the plan, deadline, activity types and modal actions remain usable. Screenshots are in `evidence/`.

## Protection and limits

Authored integration coverage for bounds, immutable history/removal, stale-write rollback, responsibility/role checks, same-stage transfer and pause/return continuity, and read-only old plans on the actual stage-advance day. Form and navigation contracts were updated. No local tests, lint, typecheck or build ran, per the user's direction; CI execution remains pending. Commit hooks handle formatting/whitespace and `git diff --check` passed.

Transfer continuity is covered in authored API tests but was not browser-validated: the existing enrollment transfer API has no matching action in the class/student UI. Finish that operational gap with V1/V3 before claiming the full movement experience complete. The current return form also retains an older native date input and should use the shared masked date pattern in that completion.

Browser QA added one regular class/plan, revised Arthur's plan and paused/returned his enrollment. These are disposable validation data; the official full seed removes them. The seed loader now sets revision `updatedAt` to its historical `createdAt`; that lifecycle refinement applies on the next official rebuild.

Product direction remains pending the user's integrated review. V9 does not mark planned activities executed, complete a stage, alter grades or change finance. V4 supplies actual lesson content.
