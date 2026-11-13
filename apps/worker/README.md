# Worker

The `school` worker registers all implemented background processing with Hatchet. Workflow names
and recurring schedules live in `@lazuli/job-contracts`; business handlers remain in
`@lazuli/worker-handlers`. The namespace isolates each workspace/database.

| Recurring work                                        | Interval   |
| ----------------------------------------------------- | ---------- |
| Due enrollment actions                                | 60 seconds |
| Received/stale assessment files and student documents | 15 seconds |
| Student health refresh                                | 60 seconds |
| Academic calendar reconciliation                      | 5 seconds  |

Cron expressions include seconds and use UTC. Business dates remain America/Sao_Paulo.
Registration uses stable workflow names, so replicas share the schedules. Each recurring task
allows one active run; CANCEL_NEWEST discards overlapping triggers without cancelling the active
run. Database claims and transactions remain necessary. Automatic retries are disabled: later cron
runs scan pending records again, while terminal FAILED records retain existing application semantics.
Recovery processes its bounded file batch within one Hatchet run.

There are no business timers or immediate local startup runs. After registration, recurring work
starts at the next cron tick, subject to worker capacity. The existing single execution slot is shared
with on-demand jobs. Hatchet must be available for both regular processing and recovery; PostgreSQL
retains pending records during outages. Workflow outputs contain status only.

Run `pnpm --filter @lazuli/worker test` for registration contract tests and
`pnpm --filter @lazuli/worker typecheck` for SDK compatibility. A running Hatchet deployment is
required to validate cron delivery, namespace isolation and concurrency across replicas end to end.
