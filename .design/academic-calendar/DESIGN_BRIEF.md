# Design Brief: Academic Calendar

## Status

Phase 2 of design-flow. Scope decisions confirmed in conversation on 2026-11-12;
brief approved by the user before information architecture. Reuse existing tokens.
No product implementation or browser validation is claimed by this document.

## Problem

School operators need to understand when academic activities can happen, define
semester boundaries, and account for holidays and recesses without maintaining
conflicting dates across the agenda and class organization. They need to see what
a calendar change affects before applying it, including whether classes retain
enough time to complete their plans.

## Solution

Add “Calendário acadêmico” as a visualization within Agenda. Operators configure
academic periods, review holiday suggestions, and register intervals without
academic activities. Before applying changes that affect scheduled activities,
they see the consequences and confirm once.

The calendar is about academic activities, not administrative opening hours.
It supplies shared dates to the existing class organization and continuity module;
it does not replace that module or execute its workflows.

## Accepted Scope and Vocabulary

- Semester boundaries are configurable; do not invent the school's dates.
- Distinguish recess between academic periods from an ad hoc interruption within
  a period. Show the gap between known periods without fabricating unknown dates.
- A gap in regular semesters and an explicitly registered suspension must remain
  distinguishable in the data. Define their scheduling implications visibly in IA;
  do not silently assume that every out-of-period date cancels an appointment.
- Registered suspensions apply school-wide to academic activities: regular
  classes, appointments, and trial lessons. No class-specific scope selector.
- Operators provide a date range, reason (holiday, recess, maintenance, other),
  and description. Copy uses “sem atividades acadêmicas”, never “escola fechada”.
- Preview affected future activities, apply only after confirmation, preserve
  completed records, and flag canceled activities/planning items for rescheduling.
- Warn about insufficient time to complete a class plan, but allow saving. The
  operator can later choose replacement lessons, period extension, or plan revision.
- Calculate impact using the actual class schedule and duration, not a generic
  subtraction of holidays. Missing planning targets must not look like zero deficit.
- “Days without class” does not mean attendance or absence tracking.
- Class continuity and organization remain separate and paused for this slice.
  No automatic stage advancement, enrollment renewal, contract renewal, installment
  changes, successor classes, or next-semester creation.

## Experience Principles

1. Explain consequences before commitment — preview activities and planning impact
   before a calendar mutation changes the agenda.
2. One calendar, distinct responsibilities — share period dates across modules
   without folding class organization or commercial operations into this screen.
3. Support judgment without blocking routine work — distinguish warnings from
   invalid input and let operators save a calendar with a known planning deficit.

## Aesthetic Direction

- **Philosophy:** existing Lazuli operational interface, compact and task-oriented.
- **Tone:** calm, clear, predictable; warnings explain actions rather than alarm.
- **Reference points:** current Agenda, Class Organization calendar, shared dense forms.
- **Anti-references:** a second visual system, oversized metric cards, wide empty
  forms, equally emphasized action clusters, or decorative animation that delays work.
- Composition is not selected yet. Explore three structurally different directions
  during the UI workshop, with the same scenarios, before accepting one.

## Existing Patterns

- Typography: Cambria/Georgia for body and display; Calibri/Segoe UI for numeric
  content, from `packages/ui/src/styles/tokens/typography.css`. No new webfonts.
- Colors: existing semantic light/dark tokens in `packages/ui/src/styles/tokens/color.css`.
- Spacing: existing 0.25rem scale and shared control sizes in `scale.css`.
- Stack: shared React UI, Base UI primitives, Tailwind, Lucide; Storybook at
  `apps/storybook`. Extend these rather than introducing another UI library.
- Agenda daily/weekly schedules use ScheduleCalendar. The academic period overview
  can reuse existing month composition without forcing a time-grid presentation.
- Shared forms use real form submission, first-field focus, date input conventions,
  inline errors, and a single primary action per task context.

## Component Inventory

| Component                              | Status | Notes                                                                           |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Agenda view navigation                 | Modify | Add academic-calendar destination while preserving daily/weekly agenda          |
| Period selector and date form          | Modify | Reuse Class Organization period vocabulary and data                             |
| Academic month overview                | Modify | Existing CalendarMonths provides a starting point; composition pending workshop |
| Interval editor                        | Modify | Extend existing closure form with academic wording, reason and description      |
| Holiday suggestions                    | Modify | Existing BrasilAPI query and selection flow; geography configurable             |
| Impact preview and confirmation        | New    | Separate activity types, affected dates and preserved history                   |
| Planning capacity warning              | New    | Explain available time versus known requirements and missing data               |
| Empty, loading, error and retry states | Extend | Reuse shared primitives; keep drafts on recoverable failures                    |

## Key Interactions

1. Enter the academic view from Agenda, choose a known period/year, and distinguish
   its boundaries, active dates, between-period recess and registered interruptions.
2. Create or edit period dates. Invalid ranges and overlap are explained inline;
   relevant downstream impacts are reviewed before applying changes.
3. Import holiday suggestions for a year/location. Preview and select dates before
   applying them; duplicates must not create duplicate suspensions. API failure
   leaves manual entry available and does not erase the draft.
4. Add a suspension with dates, reason and description. Review regular lessons,
   appointments and trials affected. Confirm to apply, then see the saved interval
   and concrete rescheduling warnings. Avoid success messages for partial completion.
5. Review class planning warnings without being forced into the paused organization
   workflow. A deficit is advisory; missing requirements are explicitly unknown.
6. Editing/removing interruptions must explain how existing cancellations are
   handled; do not silently resurrect canceled activities. Detail this in IA.

## Holiday Data

Reuse the existing BrasilAPI national-holiday integration. Suggestions are reviewed
by the operator, not automatically declared academic suspensions. Start with
configurable Brazil/UF/locality context; do not hardcode Sergipe as a product invariant.
Local dates remain manually editable. A small sourced state-holiday dataset is
acceptable if a suitable free API is unavailable; do not expand provider research.

The official Sergipe 2026 calendar identifies July 8 as the state independence
holiday. Public-administration optional days must not automatically become school
recesses. Sources examined during discovery:

- [BrasilAPI documentation](https://brasilapi.com.br/docs)
- [Official Sergipe 2026 calendar announcement](https://sergipe.se.gov.br/secom/noticia/governo_de_sergipe_publica_decreto_com_feriados_e_pontos_facultativos_de_2026)

## Responsive Behavior

Desktop provides a readable period overview with contextual details. Narrow screens
show fewer months at once or a chronological list with the same editing and impact
flows; choose the composition in the workshop. Keep dates compact, descriptions
flexible, and avoid page-wide horizontal scrolling. Validate at 1280px and 375px,
including a constrained laptop viewport and real overflow states.

## Accessibility Requirements

Keyboard access to dates, interval actions, holiday selection and confirmations.
Do not rely on color alone for date types or warnings. Provide textual date ranges,
clear accessible labels, visible focus, dialog focus restoration, announced loading
and mutation outcomes, and inline errors associated with inputs. Meet WCAG AA
contrast (4.5:1 normal text, 3:1 large text and meaningful control boundaries).
Respect reduced motion; no flashing intermediate states or layout-heavy transitions.

## Implementation Evidence and Constraints

- Existing `class-organization/calendar-*` UI and `semester-organization` API already
  support periods, holiday suggestions and closed-day ranges; reuse the underlying
  calendar instead of creating an independent source of truth.
- Current session generation skips closed dates but is additive. Registering a
  closed range does not reconcile already generated lessons. The accepted preview
  and cancellation behavior therefore requires backend work, not just a new view.
- Current period changes do not fully reconcile session generation or lesson plans.
  Audit these paths before promising accurate post-save impacts.
- Current storage uses per-date SchoolClosedDay records. Event range, reason,
  description and reliable edit/removal semantics need a deliberate persistence design.
- ADR 0005 separates academic and commercial calendars. Date changes must not
  automatically change installment schedules.
- Business dates use America/Sao_Paulo; UI copy is Portuguese-BR.
- Heavy reconciliation crosses the worker boundary; web does not import persistence.
- Browser validation uses Orca and the running workspace server. No lint, test,
  typecheck or build commands requested by the user during this work.

## Success Criteria

An operator can configure real semester dates, distinguish both kinds of recess,
import selected holidays or add an interruption manually, understand affected
activities before confirming, and see planning warnings afterward. Existing completed
records remain intact; Agenda and organization read the same period boundaries.
The interface never implies that academic recess determines administrative opening.

## Out of Scope

- Student accommodation, class reorganization, semester continuity and their redesign.
- Automatic enrollment/contract renewal, stage/book changes or financial adjustments.
- Administrative business hours, payroll and attendance tracking.
- Per-class suspension scope, automatic replacement scheduling, or a new token system.
- Invented semester dates, unsourced holiday catalogs, or automatic optional holidays.

## Next Phase

After brief confirmation: information architecture, including entry points, visual
alternatives, period versus interruption states, impact preview, and edit/removal
semantics. Then record reuse of tokens, derive tasks, and build in approved slices.

## Phase 3 User Refinements

The user selected an annual month-grid calendar with clickable month detail.
Between-semester dates are labeled “Férias acadêmicas”. Regular lessons must stay
within their assigned semester; independent appointments outside academic periods
require an explicit exceptional-use confirmation. Registered suspensions remain
distinct from vacations. Include lightweight important-date annotations, not a full
events module. See INFORMATION_ARCHITECTURE.md for these superseding details.

## Day Detail and Initial Events

User refinement: day detail may reuse the current daily Agenda. A holiday fills the
entire day grid with its academic-suspension state and reason. Events have required
start/end date-times, title and optional description; introduce the minimal
AcademicEvent entity now. This supersedes date-only annotations, while the complete
events module remains out of scope.
