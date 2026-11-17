# Calendar impact review outcome

The local impact review implements the professor-grouped direction in `BRIEF.md`. This is an
ordinary extension of Lazuli's existing visual system; no global tokens, root `DESIGN.md`, sidecar,
illustrative facts or raster assets were introduced.

## Delivered behavior

- Expandable professor groups replace individual lesson-date rows. The first group opens initially;
  native disclosure controls retain keyboard operation. Each class shows stage, existing class name,
  semester, affected dates and lesson cancellation count, with a link to its planning view.
- The review separates total cancellations, known load deficits and preserved records. Known deficits
  use “Turmas que podem não concluir a grade”; undefined plan duration is explicitly unevaluated.
- Desktop places the review beside a sticky acknowledgement panel. Below 768 px, the panel follows
  the review in one column. The shared dialog supplies its available footer actions.
- Written acknowledgement names the exact cancellation count. Missing or incorrect text blocks the
  client action and is rejected by the server before changes. Zero cancellations requires no phrase.
  Existing preview fingerprint and command idempotency remain in place.
- Planning counts include newly closed dates or dates newly excluded by a changed period, excluding
  unrelated existing closure conflicts. The change does not automatically reschedule planning items.

## Visual system retained

The implementation uses existing semantic background, foreground, heading, muted, border, warning,
destructive and success colors. Body-sized section/professor headings and caption-sized class details
use the inherited type ramp, with weight 600 for identity and tabular numerals for dates/counts.
Dividers organize the groups; the existing medium/large radii shape warning and confirmation surfaces.
No new system-wide visual rule is established by this surface.

## Evidence

The real local preview shortened 2026.2 from 30 November to 30 October and showed 72 cancellations,
20 unique classes, seven professor groups, three known load deficits and 35 affected planning items.
Browser validation covered the disabled action for missing/wrong text and the enabled action for the
correct phrase. HTTP requests with absent/wrong acknowledgement returned `400 BAD_REQUEST`.
No destructive calendar confirmation was submitted.

Reviewed captures:

- `apps/web/.impeccable/review/calendar-impact/desktop.png`
- `apps/web/.impeccable/review/calendar-impact/mobile.png`
- `apps/web/.impeccable/review/calendar-impact/mobile-confirmation.png`

The independent Impeccable review returned **ship**, with no material fixes.

## Limits

The user prohibited all project checks: lint, tests, typecheck, build, format checks, diff checks and
detectors were not run. Regression test sources were written but not executed. Browser and HTTP
evidence establishes the reviewed preview and rejection behavior; successful destructive execution
was deliberately not exercised. No observed defect was canonized into global design guidance, and
unrelated concurrent calendar/management work remains outside this outcome.
