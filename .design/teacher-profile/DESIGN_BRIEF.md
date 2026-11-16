# Design Brief: Individual teacher profile

Status: brief and metric direction accepted by the user ("otimo!", 2026-11-12).
Option A and the subsequent compact visual refinements were selected and implemented.
Source: user conversation, 2026-11-12. This brief describes the current request;
the older teacher-operations brief is historical context, not acceptance of this redesign.

## Problem

School administrators need to understand a teacher's students, teaching commitments and
registration without navigating a long, poorly grouped page. An aggregate number alone
does not explain which students or classes need attention. The current attachment lists
also depart from the student profile's familiar document viewer.

## Solution

Use the student profile as the direct visual and interaction reference. Place navigation
on the subtitle row below the compact teacher identity on desktop. Organize the individual profile into:

- **Visão geral:** compact containers, each answering one monitoring question. Proposed
  subjects are student health, learning outcomes, attendance and pedagogical follow-up.
- **Turmas:** assigned classes and the dated agenda, including substitutions, individual
  appointments and experimental lessons. The user's latest instruction moves the agenda
  out of the overview into this submodule.
- **Alunos:** current students grouped by class, with avatars, individual scores, grades, absence rates and open occurrences.
- **Cadastro:** personal and employment facts on the left, document selection and preview
  on the right, matching the student profile. Preserve existing custom attachment labels,
  multiple attachments, desktop upload and mobile capture.

Success means an administrator can identify a group needing attention, inspect the
underlying students and evidence, find an actual dated commitment, and open a labeled
document without learning a different profile layout.

## Experience Principles

1. Give every container one purpose: concise summary, evidence and a clear path to detail.
2. Keep context attached to numbers: period, denominator, coverage and missing data are
   part of a metric, not optional explanatory text.
3. Reuse the student profile vocabulary while preserving teacher-specific operations.

## Aesthetic Direction

- Philosophy: the existing Lazuli operational profile, with compact editorial grouping.
- Tone: calm, readable and useful for everyday school administration.
- Reference: the current student overview, registration facts and document preview.
- Avoid: a long stack of unrelated rows, equally prominent metric cards, decorative charts,
  oversized spacing and an attachment list replacing the preview.
- Option A: learning and cohort health above attendance and follow-up. The overview must fit a desktop viewport (verified at 1026 × 720 and 1280 × 720). Gold accents belong to metric icons and restrained rules; navigation icons keep their normal color. Health bands use green, yellow and red.

## Existing Patterns

- Typography: system Cambria/Georgia for body and headings; Calibri/Segoe UI for numbers.
- Colors: existing semantic tokens, including the student registration marquee treatment;
  preserve light and dark themes.
- Spacing: existing 0.25rem base scale, control sizes and radii in UI token files.
- Components: Base UI-backed Tabs, SegmentedControl, DataTable, ScheduleCalendar,
  buttons, loading/error patterns and shared attachment components.
- References: `packages/ui/src/styles/tokens/`, `apps/storybook/src/components/`,
  `apps/web/src/features/students/profile/`.
- Reuse existing tokens; no new palette, font downloads or design-system replacement.

## Component Inventory

| Component                       | Status        | Notes                                                          |
| ------------------------------- | ------------- | -------------------------------------------------------------- |
| TeacherHeader / TeacherSections | Modify        | Name and compact navigation on one desktop row; add Turmas     |
| TeacherRegistration             | Modify        | Match student composition; retain completed employment fields  |
| TeacherDocumentPanel            | Modify        | Horizontally scrollable icon/label selection and large preview |
| ScheduleCalendar                | Exists        | Dated day/week navigation, in Turmas                           |
| TeacherClasses                  | Exists        | Reuse links and assignment operations                          |
| TeacherMetrics                  | Draft, revise | Purposeful overview containers and shared detail tables        |
| Teacher metrics API             | Draft, revise | Explicit populations/windows and documented aggregation        |
| Existing student health         | Exists        | Reuse transparently; do not silently change student scoring    |

## Key Interactions

- Switching profile tabs preserves a deep-linkable section and teacher context.
- A summary opens the matching student, class or book breakdown. Show the population,
  source period and denominator before interpreting a percentage.
- Calendar navigation changes actual dates; events lead to their existing operational
  context. Preserve existing substitution and class-management capabilities.
- Selecting a document icon changes the preview. Horizontal scrolling accommodates
  arbitrary labeled attachments; long labels remain available accessibly.
- Upload, mobile capture and removal keep existing persistence, busy and error behavior.
- Each area has its own loading, empty and retry state. Missing evidence is never zero.

## Metric Direction

See [METRICS.md](METRICS.md) for the proposed calculation contract and research.
Keep a student-health aggregate as the requested summary. Show academic results,
attendance and follow-up separately rather than weighting the same evidence twice.
Distinguish the current students' condition from evidence during teacher responsibility.
No formula or visual composition is accepted merely because a draft already exists.

## Responsive Behavior

Desktop keeps identity and navigation together and uses a compact container grid.
At narrow widths navigation may move below the name; containers stack in reading order.
Registration facts precede documents. The document strip scrolls within its container;
the page must not overflow horizontally. Calendar uses the shared narrow-screen behavior.

## Accessibility Requirements

Preserve semantic headings, tab keyboard navigation, visible focus and accessible names
for icon actions. Targets must remain usable by touch. Do not communicate metric state
through color alone. Aim for WCAG AA text contrast (4.5:1 for normal text), honor reduced
motion, and restore focus appropriately when closing detail views or confirmations.

## Out of Scope

Teacher rankings, compensation decisions, a causal effectiveness model, new survey or
observation workflows, changing student-health weights, and redesigning the teacher list.
Historical trends require verified comparable evidence; do not invent chart data.

## Validation and Current State

Code inspection confirms existing registration, labeled uploads, responsibility intervals,
student-health aggregation and dated schedule data. The metrics and agenda drafts are
unvalidated. Metric windowing and class-specific attribution need revision before delivery.
This stage changes documentation only. Browser validation through Orca is required after
building the chosen composition; no visual acceptance is implied here. Full repository
checks remain at the delivery gate; use only targeted checks during feature work.
