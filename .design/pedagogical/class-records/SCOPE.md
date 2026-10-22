# V4 — Record and close a class session

Issue #181, child of #156, following the user's authorization for autonomous integrated implementation.

## Contract

- A dated class session brings the historical enrollment roster, manual attendance and actual content together. A regular class records one shared account; PPT records one account per present student, with the stage valid on that date. Guests and pedagogical appointments retain their separate V3/V6 flows.
- Content is a short account, primary activity type and optional lesson/reference/pages. Reviews, repeated references and activities without pages are valid. No page maximum, stage advance, assessment or financial effect is inferred.
- Nothing is persisted as a confirmed class before explicit review and closure. Initial manual attendance defaults to present, matching the existing attendance contract; the operator reviews the full list before submitting. If attendance was confirmed earlier without content, show that distinction and preserve its attribution when completing the class record.
- A session can close after its scheduled end. A cancelled session cannot close. Zero present students requires a note and no invented content. Cancelled and no-present sessions remain distinct.
- Access belongs to administration or the teacher responsible for that dated encounter, including the substitute. Freeze the actual responsible teacher at first closure, separately from who records it and from the usual teacher. Teachers can write on the same São Paulo calendar day (existing attendance policy); administration can complete/correct past sessions. Prior dates remain readable to their responsible teacher.
- Corrections require a reason and preserve each full prior state, author and time. Presence and PPT content change together: an absent student's old content remains in the prior revision, never in the current performed-work view. Reject stale record versions and stale attendance-only changes atomically.
- Show the plan version that existed at the encounter's end (or now for a future preview), with only activities planned for that date. Store that reference with the first record; later planning edits do not rewrite original intention. No plan means no planned comparison, not missing actual content. Do not copy planned work into the performed account.
- Existing attendance-only endpoints cannot alter a closed class record outside its attributed correction flow. Attendance rows and class-record history are committed in the same transaction, with an important activity event.

## Composition considered

1. Spreadsheet containing every student's presence, pages and account: compact but unwieldy for PPT narratives and narrow screens.
2. Multi-step modal per student: focused but slow for a whole roster and difficult to review collectively.
3. Weekly agenda with a dedicated class page: attendance and content stay in the same task, a contextual planned-work reference stays visible, and an explicit summary precedes closure. Selected for implementation, pending the user's integrated product review.

Use the existing editorial hierarchy, blue/navy semantic palette, restrained borders and compact forms. No new typefaces or parallel design system. Closed records display a readable account and revision history; correction is secondary.

## Evidence

Browser: regular/page-free content, PPT individual content and absence, required no-present note, correction history, plan reference preservation, substitute access, same-day teacher boundary, cancelled/future sessions, desktop/mobile/dark and Log. Integration coverage will protect atomic attendance/content, original snapshots, temporal/substitute authorization, scope, stale writes and no academic/financial side effects. No local automated checks per user; author coverage and defer execution to CI.

Seed: recent real past sessions receive varied independently authored actual accounts. Older attendance-only history remains visibly incomplete for content. Include reviewed deviations, zero-present/cancelled examples, substitutions and attributed corrections; never infer execution from planning or manufacture future attendance.
