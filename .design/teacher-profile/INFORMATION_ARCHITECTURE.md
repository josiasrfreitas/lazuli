# Information Architecture: Individual teacher profile

Status: option A selected by the user; implementation authorized by the active goal. Based on the accepted
[brief](DESIGN_BRIEF.md) and [metric direction](METRICS.md), 2026-11-12.
These are structural alternatives, not rendered or browser-validated prototypes.

## Site Map

- Existing teacher list: `/professores`
  - Individual profile: `/professores/[id]`
    - Visão geral: default, or `?secao=visao-geral`
      - Health, learning, attendance and follow-up details within the overview
    - Turmas: `?secao=turmas`
      - Dated agenda
      - Current, scheduled and historical class assignments
    - Cadastro: `?secao=cadastro`
      - Personal and employment facts
      - Labeled document strip and preview
- Existing destinations: `/turmas/[id]`, `/alunos/[id]?secao=pedagogico`,
  and `/interessados/[id]` for the corresponding agenda event.

No new global navigation entry or teacher self-service route is needed. This is the
administrative profile; existing access controls remain authoritative.

## Navigation Model

- Primary navigation: retain the app shell and its existing Professores entry.
- Profile navigation: four tabs on the subtitle row on desktop. Preserve their icons.
- Utility actions: edit remains secondary; uncommon/destructive actions stay in the menu.
  Status and system access remain distinct facts, subordinate to identity and navigation.
- Depth: profile tab, then one contextual detail area. Link to existing student/class
  pages when the administrator needs to act; do not nest additional modal stacks.
- Narrow screens: allow the tabs below the identity rather than truncating the teacher's
  name. Keep all four discoverable and the document strip independently scrollable.

## Content Hierarchy

Working priority inferred from the request: understand student condition, investigate
outcomes, consult commitments, then maintain registration. The overview is the default
entry point; no usage analytics were inspected to claim where users spend most time.

### Visão geral

Each container has a heading and icon, one main reading, denominator/period, a concise
supporting summary and a low-emphasis detail action. No agenda or full class directory.

1. **Saúde dos alunos:** current-cohort score, coverage and counts in existing health bands.
   Its context must remain distinct from outcomes during teacher responsibility.
2. **Aprendizagem:** mean eligible student grades, assessed-student coverage and a short
   book breakdown. Only show evolution when compatible paired evidence exists.
3. **Frequência:** gross absences, compensated portion and remaining absence, with
   confirmed-attendance coverage. Label these as student attendance.
4. **Acompanhamento:** pending/accompanied occurrences and links to affected students.

Opening a detail action shows one full-width detail section below the summary grid,
using the shared DataTable for operational rows. This preserves overview context without
embedding four long tables or introducing more top-level tabs. A heading, close control
and managed focus make the transition explicit. Loading, errors and empty states are
scoped to the affected content. Details inherit the metric's population and period.

### Turmas

1. Dated agenda with existing day/week controls, previous/next and today actions.
2. Events identify class, appointment or experimental lesson, date and actual time.
   Substitution context remains visible and existing management paths stay accessible.
3. Class directory below, with current/scheduled/historical context and pagination.
   The agenda never substitutes a class's recurring weekday for an actual date.

Keep a small explanatory subtitle that the agenda includes appointments and experimental
lessons, since the accepted tab label Turmas is broader in function than its name suggests.

### Cadastro

1. Personal and employment facts use the student registration composition on the left.
2. Documents occupy the right column, with icon/label choices in a horizontal strip and
   one selected document preview below. Match the student's visual treatment.
3. Attach/upload and mobile capture are contextual actions. Preserve arbitrary labels,
   unlimited application-level attachment count and existing removal confirmation.

## Overview Alternatives

All alternatives share the same metrics, explanations and detail behavior; differences are
hierarchy and available reading space, not merely decoration. Option A is accepted; B and C remain comparison alternatives.

### A. Student-profile composition — recommended

Two columns: Aprendizagem upper left, Saúde dos alunos upper right with the existing
student health emphasis; Frequência lower left and Acompanhamento lower right. Keep
semantic reading order health-first on narrow screens and align keyboard order with the
displayed layout. Use coherent containers without turning every area into an accent card.

Benefit: closest to the requested student profile, four purposes visible at a glance.
Cost: summaries must stay concise; detailed book/student lists open below.

### B. Health summary across the top

A full-width health summary introduces the period and cohort. Learning and attendance
share the next row; follow-up spans a final row for a larger pending-work preview.

Benefit: explicit reading sequence and more room for health explanation.
Cost: more vertical scrolling and a stronger emphasis on the aggregate number.

### C. Follow-up workspace

A wide left column holds pending follow-up and learning. A narrower right column stacks
health and attendance summaries. At narrow widths the follow-up work appears first.

Benefit: strongest composition for daily intervention work and longer pending lists.
Cost: moves away from the requested student composition and makes the initial reading
more focused on problems than on an overall understanding.

### Same scenarios for comparing all alternatives

| Scenario                         | A                                | B                                | C                               |
| -------------------------------- | -------------------------------- | -------------------------------- | ------------------------------- |
| Find low-score students          | Health summary, open detail      | Top summary, open detail         | Right summary, open detail      |
| Investigate low book grades      | Upper-left learning, open detail | Second-row learning, open detail | Left learning, open detail      |
| Inspect outstanding follow-up    | Lower-right summary              | Full-width final row             | Wide primary column             |
| No grades / partial evidence     | Local empty/coverage states      | Same states in larger summary    | Same states in narrower summary |
| Find a dated appointment         | Turmas, navigate dates           | Same                             | Same                            |
| Open the 12th labeled attachment | Cadastro, scroll strip, select   | Same                             | Same                            |

These paths are a structural comparison only. Browser exercises after implementation
must verify actual keyboard access, focus, overflow and density at desktop/narrow widths.

## User Flows

### Understand and investigate student health

1. Open the teacher profile and read health with cohort/coverage context.
2. Open health details and inspect scores and evidence by student or class.
3. If evidence is missing, show unavailable values with reasons rather than zero.
4. Open a student pedagogy page for existing follow-up actions; preserve a return path
   using the destination's existing navigation contract where supported.

### Investigate grades or absence

1. Open the corresponding container's detail action.
2. Read the period, responsibility scope and denominator.
3. Select the available book/class/student breakdown within that detail area.
4. Open the existing student or class context; no unrelated grades or global student
   attendance may be presented as that class's result.

### Locate a commitment

1. Open Turmas and choose the actual day/week.
2. Identify event type, date, time and any substitution.
3. Open its existing operational context. If no events exist, show an empty agenda;
   failure to load is a separate retryable state.

### Read or add an attachment

1. Open Cadastro; select an icon/label in the document strip.
2. Read the preview or open the original using existing private-file access.
3. To add another document, use the existing upload/category/custom-label flow or QR.
4. Refresh the strip after successful upload and retain a usable selection. On error,
   preserve entered data as supported by the existing editor and present a retry path.

## Naming Conventions

| Concept                     | UI label              | Meaning                                         |
| --------------------------- | --------------------- | ----------------------------------------------- |
| Summary                     | Visão geral           | Monitoring containers                           |
| Commitments and assignments | Turmas                | Dated agenda and class directory                |
| Personal/employment/files   | Cadastro              | Student-style registration                      |
| Cohort health               | Saúde dos alunos      | Aggregate of unique students' existing scores   |
| Outcomes                    | Aprendizagem          | Eligible grades and verified comparable changes |
| Student attendance          | Frequência            | Absences with compensation visible              |
| Pedagogical follow-up       | Acompanhamento        | Occurrences and linked interventions            |
| Missing evidence            | Sem dados suficientes | Never interchangeable with zero                 |

## Component Reuse Map

| Component/pattern                  | Location         | Adaptation                                      |
| ---------------------------------- | ---------------- | ----------------------------------------------- |
| TeacherHeader and Tabs             | All sections     | Compact identity/navigation row                 |
| Student summary/work grids         | Overview         | Four teacher-monitoring purposes                |
| Student health presentation        | Health container | Cohort coverage and distribution                |
| DataTable                          | Metric detail    | Explicit denominators and existing entity links |
| ScheduleCalendar                   | Turmas           | Actual dates and typed commitments              |
| TeacherClasses                     | Turmas           | Existing assignment context/pagination          |
| Student registration facts/preview | Cadastro         | Employment fields, arbitrary attachment labels  |
| Existing teacher upload/editor/QR  | Cadastro         | Preserve behavior and persistence               |

## Content Growth Plan

Keep summaries bounded; growing student, class and assessment sets belong in detail
tables with appropriate pagination. Class directory retains its existing server pagination.
The agenda queries the selected date window. Attachments grow horizontally without
widening the page; allow long labels to remain readable/accessibly named. Avoid fetching
every detail dataset merely to render four summary containers.

## URL Strategy

Retain the existing `/professores/[id]` dynamic route and nuqs `secao` convention. Add
`turmas` and `alunos` to the existing allowed values; keep `cadastro` and default `visao-geral` links
working. No new route hierarchy is necessary. Preserve unrelated query parameters.
Initially keep metric-detail and agenda controls local to the page unless an existing
shared URL contract supplies them; do not invent extra query parameters prematurely.

## Accepted refinements and implementation

Option A was selected. Subsequent user refinements add Alunos grouped by class, move the menu to the subtitle row, compact the overview to one desktop viewport, and give health a calculation dialog. See VALIDATION.md for evidence and limits. Existing tokens are retained.
