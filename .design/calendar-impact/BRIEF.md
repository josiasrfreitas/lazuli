# Calendar impact review

Operate mode. Local replacement of the academic calendar impact dialog, inheriting Lazuli's
semantic tokens, form controls, dialog primitive and existing visual identity. No global design changes.
The user explicitly requested grouping by professor, no generic tables, readable class identity,
periods and lesson counts, and written confirmation for destructive cancellation.

The compact review replaces individual lesson-date rows with expandable professor groups. Each class
shows its stage, existing class name, semester, affected interval and number of lessons to cancel.
Known hour deficits use “Turmas que podem não concluir a grade”; unknown plan duration never becomes
an invented deficit. The first professor group is expanded; all remain keyboard operable.

Desktop: wide shared dialog, change and professor groups on the left, written acknowledgement in a
sticky right column. Narrow: one column with acknowledgement after review. Footer stays available.
Cancellation totals are separate from pedagogical risk and preserved records. Typed acknowledgement
names the exact cancellation count and is required by both client and server. Zero cancellations
does not require a cancellation phrase. Existing preview fingerprint and idempotency remain in force.

Planning impact counts include newly introduced closure conflicts or dates newly excluded by period
changes; existing unrelated closure conflicts do not inflate this change's count. No automatic plan
rescheduling is introduced. Dated teacher assignments and substitutions supply group identity.

Validation uses Orca's embedded browser on the existing local domain. Never confirm destructive
changes against real classes while testing. Test absent/wrong acknowledgement over HTTP and inspect
correct-text button enablement without submitting. No project checks, lint, typecheck, build or test
runner are authorized in this session. No illustrative school facts or raster assets are introduced.
