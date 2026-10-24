# Administrative home: pedagogical triage

The administrative home starts with the work needed for students and their classes. Financial
access adds a secondary management summary; it does not replace pedagogical work or school
indicators. This is the implemented direction, pending the owner's visual acceptance.

## Priority follows the situation

The priority model is local to the home. It uses the server's `today` and `updatedAt` snapshot in
`America/Sao_Paulo`, refreshed with the home query. Queue volume never increases urgency.

| Order | Evidence                                                                                                                                                    | Presentation and next step                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | An uncovered meeting has started and has not ended                                                                                                          | Destructive state, start time and class in focus; assign the responsible teacher                                                                                                 |
| 2     | An uncovered meeting or planned student entry is today; or an unpublished entry date has passed                                                             | Today's work gets warning emphasis. A past entry is destructive because publication rejects past dates; review the dates before publishing. Today's coverage wins a tie.         |
| 3     | A meeting or student entry is tomorrow or the following day                                                                                                 | Warning, with the nearer date first, regardless of queue type or count                                                                                                           |
| 4     | An assessment or explicit allocation request has waited at least seven school dates; or a recent meeting ended on an earlier school date without its record | Follow-up. Long wait gets warning emphasis; records stay neutral. Seven days is an explicit home attention threshold, **not** a contractual SLA or a claim that work is overdue. |
| 5     | An uncovered meeting or student entry is three to six days away                                                                                             | Neutral preparation, nearer date first                                                                                                                                           |
| 6     | A received placement assessment has waited less than seven school dates; or today's ended meeting lacks its record                                          | Neutral follow-up                                                                                                                                                                |
| 7     | A student needs a class, a recent explicit allocation request needs routing, or timing is unknown                                                           | Neutral organization, no invented deadline or elapsed wait                                                                                                                       |
| 8     | An unpublished entry is at least seven days away                                                                                                            | Neutral planning                                                                                                                                                                 |

Ties between different natures use coverage, semester entry, class records, appointment records,
placement correction, students without classes, and allocation requests. Within an upcoming-date
band, the nearer date takes precedence. The next workstreams follow their most urgent queue and
retain the same ranking within each stream.

The featured task exposes up to three actual cases, an explanation and one primary action. Coverage
opens the first class directly and offers the complete queue separately. Other primary actions open
the complete queue; individual case previews provide a direct path. Totals always describe the whole
queue, not an inferred count of cases with the first preview's urgency.

## Evidence and destinations

| Queue                        | Timing fact                                                                                 | Resolution path                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Uncovered classes            | Projected meeting date/start/end; ordered before previewing                                 | Class teacher assignments and substitutions           |
| Class records                | Ended session date/time, with the responsible teacher resolved by the existing record model | Class-record consultation; follow up with the teacher |
| Appointment records          | Ended appointment date/time                                                                 | Appointment dialog and record action                  |
| Placement corrections        | Assessment `uploadedAt`, not the visit date                                                 | Lead workspace, assessment correction and entry stage |
| Students without classes     | No reliable start of waiting; student creation is not used as a deadline                    | Student profile and continued registration            |
| Explicit allocation requests | Candidate `allocationPendingAt`                                                             | Lead allocation workspace                             |
| Unpublished semester entries | `effectiveDate`, falling back to semester `startDate`, matching publication                 | Semester organization with semester/class context     |

The semester query orders by the effective date **before** pagination or the three-case preview.
A late-created proposal with an earlier entry must not disappear behind older drafts. Placement
corrections likewise sort by the receipt timestamp. Date column labels in the detail distinguish a
received assessment, start of waiting, and planned entry.

These are independent queues. A student may need both a class and a contract. There is no aggregate
people count or mandatory contract/enrollment funnel. Records older than the last seven school dates
remain accessible through a small historical link, outside current-work prioritization.

The administrative class-record dialog consults the lesson; its interactive record action is exposed
to teachers. The home says “Conferir registros de aula” and describes following up with the responsible
teacher. This feature does not broaden editor permissions.

## Adaptive composition

- Pedagogical work precedes monthly metrics. A nonempty agenda accompanies only the featured task;
  remaining workstreams occupy the full width below, avoiding a vacant column under a short agenda.
- The feature emphasizes a meeting time, an entry date, or a queue count according to its nature.
  Warnings indicate attention and preparation; destructive emphasis identifies an ongoing uncovered
  class or a date that prevents publication. Neutral work remains legible without competing alerts.
- Without current pedagogical work, triage reduces to one neutral line. School metrics and the chart
  move up. Any agenda accompanies these insights; there are no empty task cards or coverage rewards.
- An empty agenda becomes a text/link in the greeting. Queue details use the full page width.
- School entry indicators are available independently of finance permission. Financial figures and
  contract queues remain in the secondary panel and are omitted without that permission.
- The month persists in the URL and affects only monthly indicators. Current work and today's agenda
  keep their current scope. Independent financial errors do not erase known contract queues.
- Loading mirrors the priority, case previews, agenda and analytical slots. It does not claim an
  urgent/healthy state before data arrives. Reduced-motion preferences remove the loading sweep.
- A school without students, work or history keeps the first-use entry point.

## Deliberate limits and evidence

Occurrences and interventions currently record accounts and performed treatment, with follow-up notes.
They do not provide a due/open state. No learner-risk score, overdue intervention or missing-grade alarm
is inferred. Adding those queues needs a domain-backed condition and a working resolution path.

Counts of new students, enrollments and attended trials describe activity, not learning outcomes.
Their definitions and presentation still belong to the explicitly accepted
[canonical KPI debt](admin-home-kpi-debt.md). The local triage thresholds are also candidates for
product calibration; they do not become a shared task-management contract by appearing on the home.

Focused checks cover ten home behavior cases and six database integration cases. The latter use a
fresh, unseeded disposable database and remove it afterward. Static checks remain explicitly deferred
by the owner. Browser scenario evidence and its controlled-data limits are recorded in
[the scenario matrix](admin-home-scenarios.md).
