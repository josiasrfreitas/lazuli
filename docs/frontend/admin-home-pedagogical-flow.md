# Administrative home: pedagogical triage

The 2026-10-23 iteration corrects the financial emphasis of the administrative home. The first
screen should answer what the school needs to do for students and their classes. Financial access
adds a secondary management summary; it must not replace pedagogical work or school indicators.
This is the implemented direction, pending the owner's visual acceptance.

## Priority and destinations

| Priority | Existing signal | Administrative next step | Destination |
| --- | --- | --- | --- |
| 1 | Upcoming session without a responsible teacher, next seven days | Assign coverage before the meeting | Class and teacher assignments/substitutions |
| 2 | Session ended in the last seven days without a class record | Review the meeting and follow up with the responsible teacher | Existing class-record consultation, including teacher context |
| 3 | Pedagogical appointment ended in the last seven days without a result | Record the delivered appointment | Existing appointment dialog and record action |
| 4 | Placement assessment received without a defined stage | Correct assessment and define entry stage | Lead workspace |
| 5 | Active student without current or future intake enrollment | Check placement and find a class | Student profile, pending actions and continued registration |
| 6 | Lead explicitly marked as awaiting allocation | Match stage and availability to a class | Lead allocation workspace |
| 7 | Unpublished placement in a current or future semester | Review and publish the proposed destination | Semester organization with semester/class context |

The first nonempty queue becomes the primary action. Other active queues appear under teaching,
entry to a class, or continuity. The ranking is a local operational default, not a personalized
assignment, severity calculation, or canonical KPI definition. Old class and appointment records
remain accessible in a small historical link, outside the current-work priority.

These are **independent queues**. A student can require a class and a contract at the same time.
The page does not combine them into a global people total or a conversion funnel, and does not add
mandatory enrollment/contract dependencies.

The administrative class-record dialog currently consults the lesson; its interactive record action
is exposed to teachers. The home therefore says “Conferir registros de aula” and describes following
up with the responsible teacher. This change does not broaden the editor's permissions or bypass
its established workflow.

## Adaptive composition

- With pedagogical work, the primary task and remaining workstreams precede every monthly metric.
  A nonempty daily agenda sits beside the work.
- Without pedagogical work, triage reduces to one neutral line. School metrics and the school chart
  move up; any daily agenda accompanies these insights. No zero-valued task cards or coverage
  celebrations reserve space.
- An empty daily agenda reduces to a small text/link in the greeting. Details use the full page width.
- Monthly indicators always describe school entry activity. Financial figures and contract queues
  remain in the secondary management panel and are omitted without finance permission.
- The selected month persists in the URL and affects monthly indicators. Current work and today's
  agenda keep their current scope; a month change keeps their loaded data visible while refreshing
  the analytical slots. Independent financial errors do not remove known contract queues.
- A school without students, work or history keeps the existing first-use entry point.

## Deliberate limits

The existing occurrence/intervention model records accounts and performed treatment, with subsequent
follow-up notes. It does not provide a due/open state for turning every record into an overdue task.
No arbitrary aging, missing-grade alarm, or learner-risk score is inferred here. Adding these queues
requires a domain-backed condition, an owner and a working resolution path.

Counts of new students, enrollments and attended trials describe activity, not learning outcomes.
Their definitions and presentation still belong to the explicitly accepted
[canonical KPI debt](admin-home-kpi-debt.md). The priority work model is local to this feature.
