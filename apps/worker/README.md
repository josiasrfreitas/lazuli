# Worker

The `school` worker registers all implemented background processing with Hatchet. Workflow names
and recurring schedules live in `@lazuli/job-contracts`; business handlers remain in
`@lazuli/worker-handlers`. The namespace isolates each workspace/database.

| Recurring work                                        | Interval                             |
| ----------------------------------------------------- | ------------------------------------ |
| Due enrollment actions                                | Daily at 03:05 UTC (00:05 São Paulo) |
| Received/stale assessment files and student documents | Daily at 06:10 UTC (03:10 São Paulo) |
| Student health refresh                                | Daily at 06:20 UTC (03:20 São Paulo) |
| Academic calendar reconciliation recovery             | Daily at 06:00 UTC (03:00 São Paulo) |

Cron expressions include seconds and use UTC. Business dates remain America/Sao_Paulo.
Registration uses stable workflow names, so replicas share the schedules. Each recurring task
allows one active run; CANCEL_NEWEST discards overlapping triggers without cancelling the active
run. Database claims and transactions remain necessary. Automatic retries are disabled: later cron
runs scan pending records again, while terminal FAILED records retain existing application semantics.
Recovery processes its bounded file batch within one Hatchet run.

Confirmed calendar changes and explicit retries enqueue `calendar-reconcile-request` after the
transaction commits. Payloads contain only the reconciliation request ID. Dispatch failures leave
the durable request pending; administrators can resend pending requests from the calendar menu.
The daily calendar run scans the pending/stale backlog and attempts each request, continuing when
one fails. Terminal failures remain visible for an explicit retry.

There are no business timers or immediate local startup runs. After registration, recurring work
starts at the next cron tick, subject to worker capacity. The existing single execution slot is shared
with on-demand jobs. Hatchet must be available for both regular processing and recovery; PostgreSQL
retains pending records during outages. Workflow outputs contain status only.

Run `pnpm --filter @lazuli/worker test` for registration contract tests and
`pnpm --filter @lazuli/worker typecheck` for SDK compatibility. A running Hatchet deployment is
required to validate cron delivery, namespace isolation and concurrency across replicas end to end.

An administrator can also request a single student health refresh from the profile's health
heading. The request enqueues `student-health-refresh-request` with only the student ID; UI
progress follows Hatchet and completion refreshes the student and dashboard queries.

Due enrollment actions are drained in atomic batches until no scheduled action is due. Future
actions are left unchanged; the existing same-day enrollment commands still apply immediately.
Each run fixes the São Paulo business date at its start. Semester placements retain their existing
eligibility revalidation before any due movement is applied.
