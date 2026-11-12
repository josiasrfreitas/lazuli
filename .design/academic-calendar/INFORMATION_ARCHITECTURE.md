# Information Architecture: Academic Calendar

## Status and Decisions

Phase 3, pending confirmation. The brief was approved on 2026-11-12. Subsequent
user decisions supersede its provisional interval terminology:

- Annual calendar with clickable months, primarily day-level information.
- The label between configured semesters is “Férias acadêmicas”.
- Regular classes cannot have lessons outside their semester boundaries.
- Independent appointments outside an academic period require an explicit warning
  and confirmation, rather than an unconditional prohibition.
- Important dates can be marked now; a full events module remains out of scope.

## Reference Findings

These are official institutional examples, not a ranking of school quality.

- [Colégio Santa Cruz, Maringá, 2026](https://www.colegiosantacruz.com.br/wp-content/uploads/2025/09/Calendario_2026_-REVISADO-1.pdf):
  compact month grids, day markings and nearby dated annotations. Useful reference
  for the familiar school-calendar format; do not inherit its dates or day counts.
- [Chicago Public Schools family calendar, 2025–26](https://www.cps.edu/globalassets/cps-pages/calendar/25-26/district-calendar-english_25.26.pdf):
  annual family reference with period boundaries, breaks and a legend. Use the
  distinction between date categories; do not transplant its US school year.
- [Phillips Academy Andover, 2025–26](https://d2e3a5v56wj8r4.cloudfront.net/files/OFE/PA-Public-Calendar-2025-2026.pdf):
  chronological important dates grouped by term, including classes beginning,
  vacations and institutional events. Useful for month details, not the annual
  screen's main composition. Its text distinguishes no classes from campus access.

Synthesis: make the annual grid the main artifact, keep the legend nearby, reveal
short dated annotations at month/day level, and avoid appointment cards in each cell.

## Site Map

- Existing Agenda `/aulas`
  - Day `/aulas?visao=dia&dia=YYYY-MM-DD` (existing)
  - Week `/aulas?visao=semana&semana=YYYY-MM-DD` (existing)
  - Academic year `/aulas?visao=academico&ano=YYYY` (new)
    - Focused month `/aulas?visao=academico&ano=YYYY&mes=MM`
    - Selected day adds `data=YYYY-MM-DD`
    - Contextual period editor, interruption editor, holiday import, important-date
      editor, and impact confirmation; no additional top-level routes
- Existing Turmas and Organization remain separate destinations using the same periods.
- Teacher Agenda remains the existing route; do not introduce new management
  permissions or a parallel teacher calendar editor in this slice.

## Navigation Model

Primary navigation remains unchanged: Agenda is the entry point. Add “Calendário
acadêmico” alongside the existing daily/weekly view choices, rather than a nested
settings destination. Preserve daily/weekly filters when returning, but do not let
teacher/student filters narrow the school-wide academic calendar.

Annual view has year navigation and a current-year shortcut. Selecting a month
replaces the overview with its larger grid and dated annotations; “Voltar ao ano”
restores the year and focus. Selecting a day reveals details rather than opening an
editor immediately. Read access follows existing authorization; editing retains
ADMIN/SYSTEM_ADMIN restrictions enforced in the API.

On narrow screens, months flow vertically and the focused month remains available;
keep navigation visible without squeezing all controls into one overflowing row.

## Content Hierarchy

### Annual view

1. Year and academic-view identity.
2. Compact semester date ranges, with contextual “Editar” and period management.
3. Twelve month grids with day-level states; each month is keyboard-accessible.
4. Short legend: academic period, academic vacations, holiday/recess, important date,
   and unconfigured dates. Boundary markers identify first/last academic days.
5. Contextual details and any actionable planning warnings; no dashboard-card wall.

Main routine use is consultation. Registering interruptions is the principal mutation;
period setup becomes primary in the empty state. Holiday import and important-date
creation are secondary actions. This frequency ranking is a design assumption,
not usage analytics.

### Month and day detail

1. Month grid and adjacent-month navigation.
2. Selected day's academic status and explanations.
3. Events with start/end times and interruption descriptions in chronological order.
4. Reuse the existing daily Agenda grid when session-level detail is useful. A holiday
   fills the entire visible day grid with its reason, rather than a small event card;
   the semantic suspension covers the whole date, including hours outside the viewport.
   Contextual edit actions remain available without implying free appointment slots.

The calendar communicates eligibility for academic activities, not a promise that
all classes meet each day. Do not mark every Saturday as non-academic: actual class
schedules can include Saturdays. Class workload uses its real weekday/duration data.
Unknown period coverage must not be presented as confirmed vacations or active days.

## Day Semantics and Scheduling

| Situation                                        | Regular lesson                    | Independent appointment                                                   | Calendar representation                                                  |
| ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Within assigned semester, no explicit suspension | Allowed subject to ordinary rules | Allowed subject to ordinary rules                                         | Academic period                                                          |
| Outside assigned semester                        | Blocked                           | Outside all configured academic periods: require exceptional confirmation | Férias acadêmicas between known periods; otherwise period not configured |
| Explicit academic suspension                     | Blocked                           | Blocked; exception for vacations does not bypass a registered suspension  | Holiday/recess and reason                                                |
| Important date annotation alone                  | No scheduling change              | No scheduling change                                                      | Marker plus title                                                        |

Existing cancellations, teacher conflicts and eligibility rules remain effective.
The out-of-period exception applies to independent appointments; joining a regular
class session cannot bypass that session's semester. Trial lessons do not inherit
this new exception automatically; preserve their rules and audit their boundary
behavior before implementation. This is a remaining implementation question, not
an authorization to extend the appointment exception.

The end of the academic period stops regular lessons; it does not automatically
archive the class or renew enrollment/contracts. A later class opening may be useful
within the semester, but cannot establish an independent academic boundary.

## User Flows

### Consult a year or month

1. Open academic view; use selected year or the current business year.
2. See known semester boundaries and marked dates, including periods spanning years.
3. Click a month, then a day, for descriptions and important dates.
4. Return to the year without losing selection; browser Back restores navigation.

### Define or change a semester

1. Select a known period or “Adicionar semestre”; provide name, start and end.
2. Validate order and overlap. Dates are inclusive business dates.
3. Preview affected regular lessons, plan items and any changed exceptional-status
   appointments. Preserve realized records; explain historical inconsistencies.
4. Confirm; reconcile future sessions and expose processing/failure states when needed.
5. Refresh the same calendar and shared period consumers. No continuity automation.

### Register a holiday or ad hoc recess

1. Choose a day/range or the contextual registration action.
2. Enter reason and optional description; scope is all academic activities.
3. Review affected regular sessions, appointments and trials, separately grouped,
   plus class planning deficits and unavailable targets.
4. Confirm once. Preserve completed records and mark canceled future activities for
   rescheduling. Show actual completion; never imply a queued reconciliation is done.
5. If concurrent changes invalidate the preview, refresh impacts before confirmation.

### Import holidays

1. Select year and geography. Reuse national BrasilAPI suggestions; state support
   identifies its actual coverage. Manual local entries remain available.
2. Select suggested dates; show existing entries and source. Optional days are not
   silently treated as holidays.
3. Preview combined impacts and confirm the selected batch.
4. Report failures precisely and permit safe retry without duplicate dates.

### Schedule an exceptional appointment

1. Operator selects a date outside configured academic periods.
2. Before final submission show modal “Atendimento fora do período acadêmico”.
3. Copy: “Esta data está fora do período acadêmico. Você está agendando um
   atendimento extra. Use esta opção apenas em última instância.” Show date,
   student and teacher in context; actions “Voltar” and “Confirmar atendimento extra”.
4. Confirm submits the exception with the appointment. Server revalidates calendar
   conditions and all normal conflicts; client-only acknowledgment is insufficient.
5. Changes to the selected date invalidate the previous acknowledgment. Rescheduling
   follows the same rule. An explicit suspension remains blocking.

### Add an important date

1. Add a short title, optional description, and start/end date-times. End must be
   later than start; display/edit in America/Sao_Paulo and persist instants.
2. Save an AcademicEvent with a distinct annual/monthly marker and a timed entry
   in daily detail. Multi-day events mark every date overlapped by [start, end); an
   event ending at midnight does not occupy the following day.
3. To suspend activities, use the separate interruption flow and its impact preview.
   No guests, venues, ticketing, invitations or event lifecycle in this slice.

### Edit or remove an interruption

1. Open existing entry; change fields or choose removal from its contextual menu.
2. Preview newly affected dates and dates released by the change. Other overlapping
   interruptions remain effective.
3. Explain that released dates do not automatically restore previously canceled
   appointments or sessions; retain cancellation history and provide review links.
4. Confirm and show the resulting calendar state and outstanding rescheduling needs.

## Naming Conventions

| Concept                  | UI label                   | Notes                                              |
| ------------------------ | -------------------------- | -------------------------------------------------- |
| Academic visualization   | Calendário acadêmico       | Within Agenda                                      |
| Semester entity          | Semestre                   | Same Period entity already used by classes         |
| Between-period break     | Férias acadêmicas          | Never “intervalo de semestre”                      |
| Explicit suspension      | Recesso / Feriado          | Display specific reason and description            |
| Maintenance interruption | Manutenção                 | Academic effect, not administrative opening status |
| Non-blocking annotation  | Data importante            | Future events module is separate                   |
| Exceptional appointment  | Atendimento extra          | Requires confirmation outside academic periods     |
| Unknown date coverage    | Período não configurado    | Do not fabricate vacation boundaries               |
| Planning capacity gap    | Carga horária insuficiente | Advisory, allows saving                            |

## Component Reuse Map

| Component                            | Used on                   | Behavior differences                                          |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------- |
| Existing AppShell and Agenda header  | All views                 | Extend view navigation, preserve route                        |
| CalendarMonths/date utilities        | Year and month            | Extract from organization dependencies; day markers and focus |
| Shared dialog/form primitives        | Editors and confirmation  | Compact dates, meaningful descriptions, one main action       |
| Existing period forms                | Calendar and organization | Same entities; consistent impact-aware mutation path          |
| Holiday selection                    | Import                    | Combined preview and clear source coverage                    |
| Shared alerts and operational tables | Impact details            | Counts first, expandable affected records                     |
| ScheduleCalendar                     | Day/week only             | Academic year does not render a time grid                     |

## Content Growth Plan

Load periods and annotations by year with adjacent boundaries needed to derive
vacations. Twelve month grids are bounded; do not fetch all historical session
records to draw them. Fetch paginated impact details only when a mutation preview
requires them. Events accumulate by date; retain descriptions in detail, not inside
tiny annual cells. Distinct markings may coexist on a day without hiding a suspension.

## URL Strategy

Extend existing nuqs `visao` query on `/aulas`; preserve existing `dia` and `semana`
semantics. Validate year/month/date and their consistency. Invalid values fall back
to a valid visible calendar without triggering mutations. Drafts and student data
never enter URLs. Month/day selection is linkable; modal edit state can remain local.

## Layout Exploration and Validation

The user selected the annual-calendar direction. Compare three compositions within
that direction during the workshop: twelve months with contextual side details;
two semester groups with full-width month detail; compact annual grid switching to
a dedicated focused-month workspace. Do not reopen annual versus list choice.
Use identical scenarios and existing tokens; get visual direction confirmation.
Browser validation through Orca is required for implementation, not claimed here.

## Code Evidence and Remaining Enforcement Work

- `packages/db/prisma/schema.prisma`: Class.semesterId is required and references
  Period; Period owns startDate/endDate. Class has optional startDate, no endDate.
- `packages/worker-handlers/src/sessions/generate.ts`: generation uses class start
  or semester start through semester end, skips explicit closed dates, and inserts
  additively. This does not prove all mutation paths enforce the assigned semester.
- `packages/domain/src/semester.ts` resolves membership in a semester; it must not
  substitute membership in the specific class's semester when checking class dates.
- `packages/api/src/appointments/scheduling.ts` blocks SchoolClosedDay. The inspected
  slot guard has no out-of-period acknowledgment flow and uses outdated “escola
  fechada” wording. The exceptional appointment flow is new required work.
- Audit class start validation, manual session mutations, period shrink/extension,
  and trial scheduling before implementing claims about impossible states.
- Preserve late-start meaning until its usage is assessed. Removing the field from
  storage is not required to establish semester-owned boundaries.

## Initial Event Entity — Explicit Implementation Request

The user requested the basic entity during IA. AcademicEvent now has title, optional
description, startsAt, endsAt and standard UUID/createdAt/updatedAt/deletedAt fields.
No required semester relationship: events can occur during academic vacations. No
attendees, recurrence, venue, capacity or automatic suspension. PostgreSQL constraints
reject blank titles and end <= start. Schema and migration are implemented; API,
forms and calendar rendering remain future build tasks.
