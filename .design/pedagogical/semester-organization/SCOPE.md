# V8 — Next-semester organization

Part of #156. The user authorized autonomous implementation and an integrated product review before splitting the PR stack. These are implementation choices, not a claim of visual acceptance.

## Product contract

Administrators prepare future classes while the current semester continues. They assign students manually, inspect academic and timetable blockers, confirm dated availability, and publish selected eligible students. The remaining proposals stay editable. Reference capacity remains 25 and informative.

Publication creates the future class and dated enrollment; it schedules the source enrollment's exit as TRANSFERRED on the target semester's first day. Current enrollment, attendance, plans and finance remain effective under their existing dates. Regular advancement requires a confirmed APPROVED result and the next stage in the same track. Repetition requires a confirmed REPEAT result. PPT continuation retains its current stage attempt, assessment and individual plan. The final stage never invents a successor. New entrants require an explicit placement; suspended students remain blocked until the existing return process is resolved.

Availability is an attributed, append-only confirmation for a student and semester, with permitted formats, weekly time intervals and an explicit validity date. Previous or lead data can prefill the form but must be confirmed for the target semester. Invalidation appends a reason and never changes current enrollment.

Published proposals retain their evidence and immutable attributed revisions. Changes to dependencies appear as review warnings. Administrators can withdraw a future publication, with a reason, cancelling both the future entry and its paired source exit. Individual cancellation through the enrollment screen is blocked for that pair. Before applying due actions, the worker rechecks source progress, academic decision, availability, student status and the destination class/teacher. An incompatible proposal returns to draft with a system revision and both scheduled actions cancelled; it does not silently apply an outdated placement. Current teaching and assessment can continue.

Only ADMIN/SYSTEM_ADMIN manage organization. Class configuration freezes after the first publication; subsequent teacher changes use the existing dated assignment operation. A new class uses the real asynchronous encounter-generation pipeline. No automatic distribution, billing, messages, new admission funnel or per-class capacity policy is added.

## Interface direction

Three compositions considered: a drag-and-drop board (fast but hides eligibility and weak on mobile); a semester-wide matrix (dense and hard to act on individually); a class overview with a focused roster and student pool (chosen for clear partial publication and explicit blockers). Use the existing navigation, forms, filters, tables, semantic colors and square radius tokens. Separate this page, “Próximo semestre”, from stage-content “Planejamento”. One primary action per context. Product acceptance awaits the integrated review.

## Evidence plan

The protected contract is temporal and transactional: partial publication must not close the current enrollment, lose a PPT stage attempt, apply an unconfirmed result or publish using stale availability. Integration cases exercise those behaviors through the router and due-action worker; pure eligibility rules cover independent boundary cases. Author the smallest meaningful coverage and defer execution to CI under the user's no-local-checks instruction. Validate real create/edit/confirm/publish/withdraw flows, errors, attribution, desktop/mobile and light/dark in the browser. Commit hooks and diff whitespace checks remain enabled.

## Seed

One future semester; eight class plans; 32 proposals (24 current students, six waiting, two suspended); 12 published future enrollments in four partially published classes. Include expired, expiring, incompatible and missing availability, academic pendings, a terminal-stage student, teacher conflict and an unassigned teacher. Keep 250 students, existing identifiers and current-semester records. All future classes use at most 120 minutes per week; no future execution or grades are fabricated.
