# Real session generation after class creation

Issue #183. Observed during V5 browser QA on 2026-10-11, within integrated pedagogical delivery (#156).

Creating REG 05:00 through the Turmas UI and enrolling two students produced no encounters in Aulas. `classes.create` does not enqueue generation. `classes.generateSessions` exists, but the default `createLocalSessionsGenerateQueue` returns a fabricated job identifier without dispatch, and the worker entry registers no Hatchet workflows. Seed data conceals this gap because it creates encounters directly.

## Required result

- A newly created or published class obtains its dated encounters from its actual semester, recurrence and closed days through the existing session generator.
- Generation crosses the accepted worker boundary; web/API must not import worker handlers or run the semester loop inline.
- Dispatch failures remain visible and recoverable for the saved class. Retrying is idempotent and preserves existing encounters, attendance and records.
- Aulas exposes a useful generating/failure/empty state rather than claiming the class has no scheduled encounters while work is pending.
- Connect the real worker dispatch needed by V4/V5 and V8 publication. Do not expand this task to unrelated report/email/portal workflows.
- Author queue/handler contract coverage; browser-validate creation to encounter after wiring. Per user, no local suites, lint, typecheck or build.

V5 browser preparation invoked `generateClassSessions` once for a disposable QA class. This prepares a fixture; it is not evidence that automatic runtime dispatch works. Resolve this item before considering the integrated product complete.

## Implementation choices

- A persisted, attributed request is saved in the same transaction as class/semester creation. Dispatch occurs after commit. Failures keep the class saved and expose retry.
- Web and Worker use Hatchet SDK 1.37.0 with a namespace derived from the database host/name (explicit `HATCHET_CLIENT_NAMESPACE` overrides it). This isolates shared local Hatchet without placing credentials or school data in workflow names.
- Payloads contain only scope UUIDs and request UUID. A single worker slot runs generation; duplicate delivery is serialized by request and session creation remains idempotent. Status and counts are persisted; logged failures are generic codes.
- Dispatch is bounded to five seconds. A timed-out send may still arrive; the worker can complete that request safely. Five-minute stale requests permit a new attempt; older attempts may finish but never duplicate encounters.
- The generator only adds missing dated encounters; changing holidays does not retroactively cancel already created/recorded sessions.
- The SDK's optional version-warning installer and protobufjs's optional installer are disabled in pnpm; shipped runtime JS is used directly.
- Contract coverage: automatic dispatch after commit, saved class plus retry after dispatch failure, no fabricated fallback jobs, duplicate worker delivery, preservation of confirmed encounters, scope mismatch, workspace namespace isolation. Suites intentionally not run at the user's request.

Primary references consulted: [Hatchet TypeScript client](https://docs.hatchet.run/reference/typescript/client), [runnables](https://docs.hatchet.run/reference/typescript/runnables), [workers](https://docs.hatchet.run/v1/workers). Installed SDK declarations determine concrete signatures.
