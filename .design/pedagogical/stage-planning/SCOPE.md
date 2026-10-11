# V9 — Manual stage planning

Child of #156. Continues the user's authorization to implement the integrated feature before
product review and stack creation. This defines the concrete manual slice of brief §7; automatic
distribution, templates and undocumented K.T. semantics remain outside it.

## Behavior

- A regular class has a shared plan for its shared stage within its academic semester.
- PPT has an individual stage-attempt plan with an explicit start and target end date. It can
  cross semesters and years. The target is an intention, not academic completion or a billing date.
- Activities have a planned date, category (content, review, assessment or activity), title and
  optional lesson/reference and pages. Repetition and activities without pages are valid.
- Planning is manual. Show actual upcoming class dates as context; do not distribute work or
  label past planned activities completed/overdue without evidence of what was taught.
- Each change saves a full immutable version with author, server time and reason. Editing/removing
  an activity and revising the window require a reason. Removed items retain their identity/history.
- An individual plan follows the same-stage progress across transfer and pause/return. A new stage
  starts a new plan. If the student moves to regular, that class's shared plan governs the view;
  the previous individual plan remains historical and can resume after a same-stage PPT return.
- Teachers manage their currently assigned classes; administration can manage all active contexts.
  Historical contexts are readable but not editable. Financial and secretary roles have no access.
- Writes are atomic, reject stale versions, and record the important change in the activity log.
  They never change attendance, grades, actual progress dates, stage decisions or finance.

## Composition considered

1. Month calendar: shows dates well but obscures references and long titles and makes PPT switching costly.
2. Student-by-date matrix: useful for comparison, too wide for the daily planning task and mobile.
3. Context selector + compact plan summary + chronological activity table, with a separate revision
   history: keeps scope, dates and lesson references together. Selected for implementation; user
   product review remains pending, not implied by browser validation.

One dominant action adds an activity. Window revisions and version history are secondary.
The student profile and class page link directly into the appropriate context. Forms use existing
DS controls, masked dates and first-field focus. No competing table visual is introduced.

## Evidence to obtain

Browser: create regular/PPT plan; add page-free and review activities; revise an activity/window;
inspect prior version; teacher permission; desktop and mobile; student/class links and Log.
Automated coverage (author now, execution left to CI per user): regular semester/date/page bounds,
immutable revisions + stale rollback, teacher gates, same-stage transfer and pause/return continuity,
and no unintended academic changes. Form contracts protect labels, masked date and validation.
