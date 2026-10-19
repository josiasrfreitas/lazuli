# Student follow-up desk

## Approved scope

Desktop refinement of the student's pedagogical follow-up desk, within the incumbent visual
system. Mobile work is explicitly deferred. This surface direction does not change shared tokens,
components, or the product's visual identity.

## Direction

- Bound the two-pane desk to the viewport. The record rail and detail pane scroll independently;
  the detail heading and its actions remain visible while reading.
- Separate occurrences and interventions into tabs. Keep search compact and place the intervention
  status filter beside it. Keep pagination outside the scrolling record list.
- Distinguish a student with no records, existing records with no selection, and an empty search
  or filtered result. Use warm Portuguese-BR copy, restrained book/search icons, and a first-record
  action only when the student has no occurrences or interventions.
- Reuse shared buttons, tabs, inputs, selects, badges, and semantic colors. Retain a clear primary
  action in each context, with secondary and uncommon actions receiving less emphasis.

## Implementation and evidence

The surface is implemented in `apps/web/src/features/pedagogical-follow-up/` by
`student-follow-up.tsx`, `student-desk-rail.tsx`, `student-desk.module.css`,
`student-desk-empty.tsx`, `desk-occurrence.tsx`, and `desk-intervention.tsx`.

Source inspection confirms viewport-relative desk height, independent overflow containers,
sticky detail headers containing actions, pagination outside list overflow, and distinct empty
states. Controls use `@lazuli/ui`; colors and display typography reference incumbent tokens.

Browser evidence supplied by the implementing agent on 2026-10-13 reports a 740px desk in a
900px-high viewport, independent pane scrolling without main-page movement, and an unchanged
heading position during detail scrolling. The actual empty-student and empty-search states were
also exercised. Reviewer disposition: ship, with no material findings. This documentation pass
did not independently rerun those browser checks; no mobile validation is claimed.

The current frontend guide and semantic-color guidance remain authoritative. No new raster assets
or global design-system documentation were produced for this refinement.
