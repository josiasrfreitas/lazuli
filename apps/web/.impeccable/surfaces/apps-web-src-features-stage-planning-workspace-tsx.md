---
version: 1
slug: "apps-web-src-features-stage-planning-workspace-tsx"
primary_target: "apps/web/src/features/stage-planning/workspace.tsx"
related_targets: ["apps/web/src/features/stage-planning/journey.tsx"]
---

# Planning: ability to finish the semester

## Accepted purpose

On 2026-11-12 the user explicitly rejected the implemented numbered map, long
encounter list, and adjacent recorded-lessons view. Earlier technical QA and a
finish-review ship verdict do not establish acceptance of that composition.
The user asked to stop implementation, understand the problem and redesign.

Confirmed by the user:

- Primary: determine whether the class can complete its curriculum by the semester
  boundary, and understand what must change if it cannot.
- Secondary: follow past, current and next content.

The previous implementation description is provenance only, not the accepted target.
The user approved the following composition with “ok” and requested the complete
Impeccable craft workflow. Implementation and validation are authorized.

## Approved hierarchy

1. **Semester outlook.** Lead with a concrete outcome: curriculum fits with margin,
   fits with no margin, or exceeds remaining available lesson time. Pair remaining
   nominal curriculum hours with scheduled teaching hours remaining before the
   semester boundary, then state the difference as margin or shortfall. The ending
   is fixed by the academic calendar. The only editable planning date is the start.
2. **Reason and possible response.** Explain what produces the outcome. When there
   is a shortfall, quantify it and distinguish extra teaching time from changes to
   delivery pace. Do not automatically compress content, move the semester end or
   propose deleting curriculum. Adjustment simulation is a separately reviewable
   behavior, not a promise that scheduling actions already exist.
3. **Content context.** A subordinate, compact past / current / next sequence uses
   unit and book-lesson names, parts and contextual activity names. Example:
   “Vídeo · entre as lições 4 e 5”. Each position exposes detail only on demand.
   Past browsing is by unit/lesson, not an unbounded chronological list of sessions.
   A video or review remains a distinct activity, not a fabricated book lesson.
4. **Evidence at the point of need.** An activity can expose the date(s) and actual
   class record(s) supporting its completion. Full lesson history remains in the
   class's existing Aulas module; no duplicate recorded-lessons tab in Planning.

A bounded first viewport must answer the primary question and show the content
context on the user's 13.6-inch laptop. Detail is progressive, not an infinite list
below the summary. Narrow screens reflow naturally; no horizontal content overflow.
Scrollbar space stays outside the content on overlay-scrollbar systems such as macOS.

## Calculation contract and honest uncertainty

- Remaining curriculum load uses source activity durations, not raw item counts.
  A lesson can contain multiple activities; a session can cover multiple activities.
- Available time uses eligible future sessions up to the semester ending, accounting
  for cancellations and school closures. It is not an arbitrary count of weeks.
- Completion requires explicit activity coverage. Latest reached activity alone does
  not imply all previous activities are complete.
- A partial activity has unknown remaining effort unless explicitly measured. Show
  uncertainty or a conservative bound, not an invented fractional completion.
- The primary comparison is against the curriculum's nominal load. It is not a
  prediction that a teacher will work at a constant historical pace. Any later
  pace-based forecast needs a separately explained method and sufficient evidence.
- Missing coverage is missing evidence, not proof of content remaining. Do not show
  a confident shortfall from incomplete records; prompt confirmation of the baseline.
- When initial workload exceeds semester capacity, show a read-only curriculum
  preview and deficit. Unsupported activities remain undated; do not persist
  invented dates or extend the semester.

Illustrative case only, assuming 14 hours remain in the calendar:

| Confirmed content still to teach | Calendar time | Reading              |
| -------------------------------- | ------------- | -------------------- |
| 4 nominal hours                  | 14 hours      | 10 hours of margin   |
| 14 nominal hours                 | 14 hours      | Fits, without margin |
| 26 nominal hours                 | 14 hours      | 12-hour shortfall    |

The development database was verified on 2026-11-12: the three synthetic classes
now have continuous explicit completion coverage through activities 36, 26 and 14,
with 840 remaining calendar minutes each. Corrections preserve the audit history.

## Required data repairs before evaluating the new design

The three synthetic classes linked each session only to its last reached activity,
creating artificial holes. Correct all actually covered activities through explicit
recording support; do not mark intermediate activities complete by inference or
create fictitious sessions. Preserve attendance, grades and existing audit history.
The record contract now supports multiple explicitly selected activities, each with
its own completion status. Legacy single-activity records remain readable.

Activity labels must come from the canonical curriculum and its lesson relationships.
Unknown source abbreviations stay unknown. Describe sequence context (before, between,
after lessons) without inventing the video's topic or a review's instructional scope.

## Boundaries

- Keep source-program versioning at the stage level; no class Versions UI.
- Reuse the same outlook/content vocabulary for future individual planning. Do not
  build that student page as an unsolicited extension.
- Preserve the app's visual system and existing controls. This is a hierarchy and
  behavior redesign, not a global theme replacement.
- No database reset, broad check suite, or unrelated calendar changes.
- The accepted hierarchy is settled; do not reopen the rejected numeric-map direction.

## Direction contract

THESIS: Semester feasibility leads; named curriculum context supports it. The user
approved this composition after rejecting numbered maps and duplicate lesson history.

OWN-WORLD: Existing Lazuli navigation, typography and semantic surfaces. Restrained
status colors communicate margin, no margin and insufficient evidence. No new theme.

STORY: Read the semester outcome, compare remaining workload with available hours,
then inspect the current/next lesson or a past lesson only when needed.

FIRST VIEWPORT: Compact existing class header; one dominant semester-outlook region
with a plain conclusion and hours comparison; below, a subordinate past/current/next
strip. Content detail is bounded and user-invoked, never a long default list. The
signature interaction is entering a named lesson to see actual versus planned dates.
Native disclosure and dialog transitions carry state; no entrance choreography.

FORM: User-pinned, code-led Operate composition; no seed key or concept tournament
because the user explicitly confirmed the structure. This replaces a feature inside
an established application; it does not replace the app's identity.

FINISH: unreviewed and undocumented is unfinished. This ordinary extension ends
with the finish review, its scoped verdict, and an assessment against the inherited
system. It does not require a global DESIGN.md rewrite. Any shipping raster would
require provenance; none is introduced here.

The existing system is inherited. The documenter must assess it without rewriting
unrelated global design files. No generated raster assets are planned.
