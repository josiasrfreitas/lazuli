# Validator coverage routing

Issue #70 asked for the validator mutation report to stop treating externally
covered behavior as a local package gap. This note records the classification used
for the validator test refactor that followed issues #60 through #63 and PR #72.

## Local validator contract

`packages/validators` owns pure schema contracts: accepted enum members, required
and optional fields, coercion, trimming, bounds, strict object rejection, and
cross-field refinements that can be checked without Postgres. The local mutation
report must execute every validator file so `NoCoverage` means a real local test
gap instead of "covered by an API integration test elsewhere."

The focused reproduction before this refactor left these validator files with no
local coverage: `attendance.ts`, `class.ts`, `enrollment.ts`, `finance.ts`,
`makeup.ts`, and `student-list.ts`. The same reproduction after the refactor has
zero `NoCoverage` mutants for the package:

| File                  | Killed | Survived | NoCoverage | RuntimeError |
| --------------------- | -----: | -------: | ---------: | -----------: |
| `src/attendance.ts`   |     10 |        3 |          0 |            0 |
| `src/calendar.ts`     |     42 |        7 |          0 |            0 |
| `src/class.ts`        |    131 |       17 |          0 |            0 |
| `src/enrollment.ts`   |      9 |        5 |          0 |            0 |
| `src/finance.ts`      |     39 |       18 |          0 |            3 |
| `src/makeup.ts`       |      7 |        4 |          0 |            0 |
| `src/reports.ts`      |     39 |        7 |          0 |            0 |
| `src/student-list.ts` |     19 |        0 |          0 |            4 |
| `src/student.ts`      |     61 |        2 |          0 |            8 |

The package score for that run is 85.00 percent with the configured break
threshold at 75 percent.

## Routing by validator

| Validator      | Local unit coverage added or kept                                                                                                                                           | External coverage that remains external                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance`   | Lookup UUID inputs, MVP status enum, empty confirm payload, row strictness, edit row minimum.                                                                               | Roster membership, session windows, off-roster rejection, duplicate confirms, edit persistence, and makeup side effects stay in `packages/api/test/attendance/*.integration.test.ts`.                                                                                                        |
| `class`        | Regular versus personalized create input, slot time format and ordering, portal-name/shared-stage refinements, enum literals, generate-sessions scope, clone/archive input. | Class persistence, portal names, enrollment conflicts, and generation enqueue behavior stay in `packages/api/test/classes/*.integration.test.ts`; job payload shape stays in `packages/job-contracts`.                                                                                       |
| `enrollment`   | Create/advance/transfer/close schema parsing now lives in `packages/validators/test/enrollment.unit.test.ts`.                                                               | Enrollment role gates stay in `packages/api/test/enrollment/role-gates.unit.test.ts`; lifecycle, capacity, stage, transfer, and closure behavior stays in API integration tests.                                                                                                             |
| `finance`      | Due days, enums, order payer modes, direct payer creation, order update, payment allocation input, reconciliation batch input, waiver, and adjustment input.                | Installment generation, payer/beneficiary existence, lock behavior, allocation balances, and adjustment sign rules stay in `packages/domain/test/finance-ledger.unit.test.ts`, `packages/db/test/schema/finance.integration.test.ts`, and `packages/api/test/finance/*.integration.test.ts`. |
| `makeup`       | Schedule/cancel/outcome input IDs, optional and trimmed reason fields, and boolean attendance outcome.                                                                      | Target date rules, same-class restrictions, duplicate makeup detection, cancellation effects, and outcome side effects stay in `packages/api/test/attendance/makeup-*.integration.test.ts`.                                                                                                  |
| `student-list` | List input defaults, status/search bounds, row output shape, finance summaries, and paginated output shape.                                                                 | Counts, enrollment summaries, attendance summaries, finance summaries, and web display usage stay in `packages/api/test/students/list.integration.test.ts` and the relevant web reducer/page tests.                                                                                          |
| `student`      | Document pair validation, name/date/message contracts, enums, guardian modes, search/notes/status inputs.                                                                   | Router use of search input stays in `packages/api/test/students/search.unit.test.ts`; profile integration owns the minor guardian error messages.                                                                                                                                            |
| `calendar`     | Year/date bounds, real `yyyy-mm-dd` dates, reason trimming/length, import/add/remove inputs, and semester range/name rules.                                                 | Holiday import, closed-day persistence, remove behavior, and semester session generation stay in `packages/api/test/calendar/*.integration.test.ts`.                                                                                                                                         |
| `reports`      | Artifact enums, request inputs including attendance summary and monthly accountant CSV, result/artifact output, artifact lookup input, and status derivation precedence.    | Artifact enqueue, access control, polling, worker-visible status, and report persistence stay in `packages/api/test/reports/*.integration.test.ts` and worker handler tests.                                                                                                                 |

## Survivors and equivalents

Remaining validator survivors are classified as message-string contracts unless a
test already names the message as user-visible behavior. The student document
pair message is now asserted in the validator package with an independent literal;
the minor guardian messages remain covered by the student profile integration tier
because the API procedure owns when those messages are surfaced.

Two calendar conditional mutants are equivalent with the current regex and date
normalization: an invalid day overflows the month and an invalid month overflows
the year, so the year/month/day comparisons reject the same reachable input set.
The `class` null-branch mutants around `portalClassName` are unreachable because
the base schema rejects `null` before the `superRefine` branch can run.

RuntimeError mutants in discriminated unions were not counted as part of this
coverage-routing finding. They belong to the separate issue #70 item about
invalid TAP initialization during mutation runs.
