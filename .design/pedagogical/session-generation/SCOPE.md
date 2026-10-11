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
