# V5 — Student attendance declarations

Issue #182, child of #156, implemented under the user's authorization for autonomous vertical delivery in the integrated branch. These are explicit execution choices for product review, not claims that discarded workshop hypotheses were accepted.

## Contract

- A student submits a declaration for one dated class through a QR/link opened by its responsible teacher (including a dated substitute) or administration. This does not create Attendance, confirm a class, assign absence, generate content or affect grades/finance. The teacher reviews declarations beside the manual call and confirms the final result through V4.
- Regular and PPT share this identification flow. Only enrollments valid on the encounter date participate. Experimental guests and V6 appointments retain separate attendance flows.
- Opening is available on the São Paulo encounter date, from 30 minutes before the start until its end, while the encounter is neither cancelled nor attendance-confirmed. Choose 10, 20 or 30 minutes; validity is capped by the encounter end. Closing revokes immediately. Reopening generates a new random link and revokes the old one; already received declarations remain. Completing the call or class record closes all remaining windows atomically.
- The public page requires no student account. A high-entropy token grants only this encounter's bounded lookup/submission; persist its hash. The token stays in the URL fragment and is sent to read/search/submit endpoints using POST, never as a server URL parameter. A teacher can display a freshly generated QR and copy its link; after a reload they can generate a replacement. Never expose a general roster or school-wide search publicly.
- Search requires at least three characters and matches name words ignoring case/accents. A unique exact full name may be selected automatically; partial and ambiguous names require a choice and explicit submission. Literal homonyms are distinguished only by the last four phone digits when available and different. Indistinguishable homonyms use manual teacher recording; never choose the first database row. Return at most eight matches and ask to refine a broader query.
- In-person submission requests one current device location with accuracy. Missing/denied location offers retry and manual teacher recording, without submitting a false declaration. Store the evidence in Cloud SQL. An optional teacher location at opening permits an approximate distance for review. Do not invent a campus address, mandatory radius or automatic geographic rejection rule: location and its precision are evidence for the teacher, not proof of physical presence. Online submission does not request or store location.
- One accepted declaration per student enrollment and encounter; retries return the original receipt without changing its time/evidence. Keep the entered name, resolved enrollment, match kind, timestamp and window. A later window may not overwrite the first declaration. Expired, revoked, cancelled, off-roster and already-confirmed submissions cannot write. Serialize with the existing class-record lock so a concurrent closure cannot receive a late declaration.
- Staff see attributed window opening/closing and declaration timestamps in the encounter. The important-activity timeline records window opening/closing; individual declarations belong to the encounter's review, avoiding a noisy global event per student. Final attendance remains attributed to its staff recorder.

## Composition considered

1. Separate QR management page: easy projection but splits one class's task across routes.
2. Permanent QR above every roster: quick access but crowds closed historical records and competes with the lesson account.
3. A compact presence section in the encounter, with a focused QR dialog and an independent mobile student page. Selected: active controls remain contextual, received declarations appear beside the manual call, and closed encounters retain readable evidence.

Preserve the editorial Lazuli design, semantic navy/blue palette and shared form controls. QR rendering uses a local SVG component, with its standard high-contrast quiet zone for reliable scanning; no external image service or analytics. Reference: https://github.com/zpao/qrcode.react.

## Validation and seed

Author meaningful rule and integration coverage for matching/homonyms, token expiry/rotation, date/teacher scope, location requirements, repeat receipts, no Attendance side effect and closure races. No local automated suites, lint, typecheck or build per user. Validate actual teacher/admin and anonymous student flows in the browser, including mobile, error recovery and manually confirmed attendance.

Extend the one official full seed with a handful of historical windows/declarations on existing regular/PPT encounters, mixing declarations and manual attendance. Preserve existing results. Give one existing seeded class a coherent online history from initial generation, without changing fixture identifiers. Prepare at most one safe recent encounter as attendance-pending before dependent loaders, if it has no grades/occurrences/visits/makeup dependency. Otherwise document omission instead of clearing history. Use real current sample names for partial-name ambiguity; literal homonyms are protected by isolated test fixtures, without renaming established seed students. Do not leave an artificially open QR on a Sunday with no scheduled encounter.
