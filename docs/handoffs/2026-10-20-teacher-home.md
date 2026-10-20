# Teacher home — 2026-10-20

The teacher landing route `/professor` now presents the next useful teaching actions. The agenda
lives at `/professor/agenda`; legacy `/professor?dia=…` links redirect there with the selected day.

## Delivered behavior

- Five summary links jump to lesson records, assessments, upcoming exams, planning notices, and
  pedagogical appointments. The oldest pending lesson receives the primary register action;
  expandable lists expose the remaining work.
- Assessments include missing grades across four competences and two regular phases, plus
  assessment appointments. Other pedagogical appointments, assigned placement and individual
  introductory visits appear under appointments. Uncorrected placement proofs stay visible.
- Exam notices cover planned assessments within seven days. Planning notices compare the latest
  linked step with steps scheduled at least seven days earlier, allowing one planned encounter
  before or after the current reference. Unlinked records retain the comparable-material page
  comparison. Missing records do not establish delay; unconfigured plans are disclosed separately.
- Existing server-side teacher scopes and permission checks are reused. Existing diary, grade,
  and appointment dialogs remain the action destinations. Home data refreshes every 60 seconds.
- Completion feedback refers specifically to the diary, clears when pending work increases, and
  uses one 320 ms book motion. Reduced-motion preferences remove that movement.

Implementation: `apps/web/src/features/teacher-workspace/` contains `home.tsx`, `home-state.ts`,
`home-parts.tsx`, `home-sections.tsx`, and `home.module.css`; the API counterparts are
`packages/api/src/teacher-workspace/home.ts` and `home-planning.ts`.

## Preserved visual system

This is an extension of the incumbent workspace: inherited Cambria and numeric stacks, semantic
colors, shared controls, existing light and dark themes, and quiet list separators. The greeting
is 19 px, section headings and row titles are 14 px, and supporting text is 13 px.
Focused grade and placement dialog titles are 16 px. Mobile uses compact stacked groups; desktop adds a
secondary notices column. Loading groups follow the same compact hierarchy.

No competing token system, raster assets, or visual-world replacement was introduced. Shared
tokens remain under `packages/ui/src/styles/`, imported by `globals.css`. The direction contract
is `apps/web/.impeccable/surfaces/apps-web-src-features-teacher-workspace-home-tsx.md`.

## Validation and limits

Browser validation used the synthetic local teacher Clara with one pending lesson and four grade
rows. It covered diary detail and form opening, grade opening, expansion reaching all four rows,
section navigation, the actual planning tab destination, Agenda navigation, and error retry
restoring live data. Appointment detail opened through a browser-injected upcoming entry pointing
to an existing completed assessment appointment. No database mutations or saves were performed.

Both themes were inspected at 390 px and 1440 px; an additional 320 px overflow scan found none.
Empty, populated future-notice/planning-lag, failure, and final loading presentations used labelled
temporary query-cache simulations. Original data was restored and the QA marker removed.
Captures: `.impeccable/review/teacher-home`.

Finishing review identified oversized loading capsules; compact skeleton groups resolved that
finding. The final “ship” verdict covers that reviewed correction, with no visible regression.
This evidence does not establish exhaustive behavior or production readiness. Automated tests
were not run; final static gates were omitted at the owner's request. A clean whole-branch static
baseline is not established.

Known pre-existing `PRODUCT.md` drift remains: Cloud SQL terminology and consultation-only
attendance lag later infrastructure decisions and the integrated diary. It was left unchanged.

## Assessment and density follow-up

Grades, observations and proofs share a dialog opened by an icon-only edit button at the end
of each competence row. Its only context selector is the unit. Written and Listening support
files; Oral and Participation have no upload area. The unit and recovery tables fill their
container, keeping the assessment label narrow and sharing the remaining width across numeric
columns. Recovery remains a separate collapsible table. New academic files carry their
competence and phase without an appointment selector.
Legacy unclassified files can be identified explicitly. Placement remains inside its assigned
visit, with the original proof, stage, observations, and an optional corrected proof.

The subsequent browser pass saved a demo grade and academic PDF, confirmed their persisted
association, then restored the grade and removed the new file through the UI. The upload reached
RECEIVED; worker completion was not verified. A synthetic class record remains saved as an
assessment linked to a PARTIAL planned step. Its planning view showed the expected tolerance band.
These saves supersede the initial read-only validation described above.

Final density captures are in `.impeccable/review/teacher-final`. Grade and placement dialogs were
inspected at 320, 390 and 1440 px, with no horizontal overflow and single-line action labels.
Action icons were added across the teacher flows. The shared attachment dialog has an opt-in
compact presentation for focused teacher uploads. The home notice rules were reviewed in source;
the new step-based overdue branch has not been exercised with a persisted delayed-plan fixture.
No lint, automated tests, builds or static checks were run, as requested.

Optional observations are stored per competence and phase in `StageAssessment.observations`,
independently of a score. Note-only changes increment the assessment version and record activity
without revoking its pedagogical confirmation. Existing clients that omit notes preserve them.
The additive migration is `20261021120000_assessment_observations`.

The row-dialog follow-up was exercised in the shared Avaliações workspace with the current
local seed (Arthur Menezes Campos), using the administration profile. At 320 and 390 px,
both table frames matched their available width (240 and 310 px); the desktop width cap
was removed as well. The 320 px pass exposed a clipped unit selector, corrected by bounding
the form grid and fitting the three choices in one row. A Written recovery observation was
saved without a score, verified after a full reload, and then cleared through the UI.
Existing grades were preserved. Unit switching retained the selected proof in its own unit;
discarding removed the draft, and Oral had no upload controls. This pass did not send a new
proof or repeat the teacher-home entry flow. Captures are the `row-dialog-*`, `written-modal-*`,
`written-recovery-modal-320.png`, and `oral-modal-1440.png` files in
`.impeccable/review/teacher-assessment-redesign/`.
