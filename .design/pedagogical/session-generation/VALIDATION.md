# Runtime encounter generation — browser validation

Validated on 2026-10-11 in the integrated workspace through Orca's embedded browser, using Clara Ribeiro's administrative session. One web server runs on port 3004; one single-slot Hatchet worker processes this workspace's namespace. A token for the existing local Hatchet tenant was generated through its admin CLI and saved only to the ignored workspace `.env`.

## Observed behavior

- Created regular class REG 05:00 through Turmas: Camila Duarte, semester 2026.2, Connect 1, Monday 05:00–07:00. Class `bbc9316d-ca5d-4197-b971-40b3efba6f83` survived the initial missing-token dispatch failure. Its detail showed the saved class, attributed request and “Tentar novamente”.
- Retried from that button with the worker offline. Hatchet accepted the request; the class showed “Preparando as aulas”. Restarting the worker produced 23 encounters and the open page changed automatically to “23 encontros preparados”. Hatchet run `666d7383-1cd2-4760-ae13-0d127e8ebc74` corresponds to the persisted successful request.
- Opened Aulas da turma and saw the actual 05/10 encounter with schedule, responsible teacher and record action.
- Selected “Atualizar encontros”: the next request succeeded with zero new sessions and 23 planned sessions. The count and digest of ordered encounter IDs remained unchanged (`f49c3f24c98a28cfaed6e74f5165adfe`, 23 rows).
- Created a second class through the form after configuration was complete: PPT 05:00, Camila Duarte, Tuesday 05:00–06:00, class `39dc6f8d-7ba1-4a5c-9aeb-f423a482f5b1`. Automatic dispatch completed with 26 encounters, without pressing retry or invoking a handler manually.
- In Aulas for the week of 12/10, temporarily paused the sole worker process and requested refresh. The page showed preparation instead of an empty-agenda message. After resuming the worker, it showed completion and the legitimate empty week: Monday 12/10 is a school closed day. No encounter was created on that holiday.
- Inspected 1280×800 and 390×844, light and dark. Status text wraps, recovery remains available, and the pending state occupies the agenda without an overlapping empty state. Screenshots are in `evidence/`.

The database now includes two disposable runtime-QA classes in addition to the official 22-class baseline. No student was added. The next official seed rebuild may remove these records; screenshots remain evidence of the observed flow.

## Scope and limits

Browser evidence proves real API → Hatchet → worker → database → UI dispatch and recovery, plus retry idempotence on these encounters. Preservation of already confirmed attendance, duplicate simultaneous delivery, cross-scope payload rejection and namespace isolation have authored automated coverage, not local execution. No claim of browser coverage for those cases. No local lint, tests, typecheck or build ran, as requested. Commit hooks formatted files and checked whitespace; `git diff --check` passed.

Commits: `750da50` (runtime and contracts), `9b3820d` (status/recovery UI), `fe69561` (pending agenda behavior). Migration 46 is applied; Prisma and Kysely clients were regenerated for runtime use. Before its first successful commit, the new empty, unpublished generation migration was locally rolled back and reapplied to remove a trailing blank line caught by the commit hook. No existing migration or school record was changed by that rollback.
