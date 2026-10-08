# Issue 158 — browser and design evidence

## Scope of this review

The final review prioritizes desktop, following the user's instruction “foco 100% em desktop”. The `frontend-design` direction is functionalist: compact groups, a strict weekly grid, restrained semantic colors, quiet borders, and one dominant action in each task. Lazuli's existing Cambria/Calibri tokens and no-webfont policy take precedence over the skill's generic font recommendations.

This is an implementation review, not a claim of user visual acceptance or a complete accessibility audit.

## Exercised against the running application

Local isolated database `lazuli_issue_158`, real Next development server, Chromium, and local Mailpit authentication. No mocked API responses or placeholder screenshots.

- Registered Marina Costa with CPF and e-mail, leaving access disabled. Initial focus landed on the name; Enter submitted and opened the persisted record.
- Empty registration showed field errors and focused the first invalid field.
- Listed and searched teachers; opened Camila Duarte's week with 5 hours from the seeded meetings.
- Assigned Marina to Camila's Thursday 19:00–20:30 meeting. The usual teacher remained visible, and Marina's week showed 1.5 hours despite having no login access.
- Ended Marina's operation today. The preview identified the one future substitution. Confirmation revoked it and exposed one uncovered meeting. Assigned coverage again and observed an empty pending list.
- Registered Lucas Andrade with access disabled and created a real Tuesday/Thursday 14:00–15:00 class using him.
- Tried a dated assignment to Juliana Prado. The application rejected her overlapping class and showed its code, date and interval. Assignment to Rafael Mendes succeeded and retained Lucas in the dated history.
- Sent two simultaneous authenticated class-creation requests for Lucas at Monday 10:00–11:00. One succeeded (HTTP 200); the other was rejected with the committed conflicting class (HTTP 400).
- Applied both new migrations successfully to the isolated database. The second adds the lifecycle columns required by decision 0011; the first applied migration was not rewritten.
- Ran `node --import tsx --test packages/domain/test/teacher-schedule.unit.test.ts`: 2 passed, 0 failed. Expected hours and half-open intervals come from the issue's examples.

## Desktop design findings and corrections

| Criterion           | Observation and correction                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action hierarchy    | Registration has one primary submit action. Departure is contextual and confirmed separately. Removed “Novo professor” from the pending-coverage task.              |
| Compact composition | Name spans the registration form; CPF occupies one third and e-mail two thirds. Dated assignment now places the short date and teacher selector on one aligned row. |
| Weekly readability  | Shared day columns and time bands; whole-meeting controls retain 60-minute subdivisions. Removed repeated arrows that made intervals wrap at 1280 px.               |
| States              | Exercised empty, loading, invalid fields, conflict, saved substitution, ended operation and resolved coverage. Fixed a missing Field context in registration.       |
| Terminology         | Portuguese interface and Brazilian date formatting in the conflict message; singular/plural departure counts corrected.                                             |
| Color and type      | Existing light/dark tokens inspected in the real page. No replacement font, new palette or decorative animation.                                                    |
| Layout              | Inspected 1440×1000 and 1280×900. Document width matched viewport width.                                                                                            |

## Screenshots

Final desktop captures: [list](evidence/list-desktop.png), [registration](evidence/registration-desktop.png), [week dark](evidence/week-desktop.png), [week light](evidence/week-desktop-light.png), [1280 px week](evidence/week-desktop-1280.png), [assignment conflict](evidence/assignment-conflict-desktop.png).

Journey checkpoints: [substitution](evidence/substitution-desktop.png), [departure preview](evidence/departure-desktop.png). These precede the later wording/spacing polish.

An earlier [375 px checkpoint](evidence/week-narrow.png) was captured before the user redirected the review entirely to desktop. It is not a final mobile acceptance claim. The temporary Next development indicator was hidden in the final desktop screenshots; application content and network responses were not replaced.

Before evidence comes from the real committed V1 [class listing](../157/evidence/list-desktop.png) and [narrow class listing](../157/evidence/list-narrow.png), at base commit `c319f680dffb14235063dd61003e93216f5738a0`. These are existing baseline captures, not newly captured teacher screens.

## Remaining validation limits

Lint, typecheck, production build, whitespace gates and the full integration/transport suites were not run after the user's prohibition of checks. Browser testing and the focused domain tests do not establish those gates. New form contract coverage and the complete temporal/authentication regression matrix remain unverified.

The PR is stacked on `josiasrfreitas/issue-157`. The current CI workflow runs pull-request jobs only against `main`, so this base does not produce the required CI success signal. Do not report stable green CI or merge readiness from the browser results.
