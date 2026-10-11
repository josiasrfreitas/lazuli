# Lead follow-up validation

Issue #176; integrated branch `josiasrfreitas/operacao-pedagogica`, 2026-10-11.

The commercial workspace prioritizes the next conversation: contact-only capture, an assigned
owner, a dated next step and authored contact history. Pedagogical qualification remains a later
step. The contact person does not automatically become the student's guardian or payer.

## Browser evidence

Validated against the running application at `http://operacao-pedagogica.lazuli.localhost`:

- Empty capture submitted with Enter shows name/contact errors. Opening focuses `lead-name`.
- Created Marina Oliveira with phone, contact person and source; left modality, format, stage and
  availability unknown. The profile displays those unknown states, without enrolling a student.
- Set a next step for today and assigned Clara Ribeiro. Saved state appears in the profile and
  the `Hoje` queue. `Sem próximo passo` excludes the scheduled lead; `Em atraso` shows a filtered
  empty state with the current pre-existing seed.
- Recorded a conversation and confirmed its date, text and author in the contact history.
- Edited the source using the independent contact dialog and submitted with Enter. Pedagogical
  fields remained unknown. Dialog body fit at desktop size: client/scroll height both 280px.
- Inspected desktop light/dark and narrow 390px views. Narrow document width equals viewport width.
- Combined format/stage in the interest column so the five-column queue fits at 1280px:
  table width 1183px, document/viewport width 1280px.

Screenshots are in `evidence/`. Only the integrated dev server is running. Its process was restarted
once to load the new Prisma client after applying the additive migrations; development data was not
reset.

## Automated coverage and limits

Authored integration coverage for unqualified capture/edit, civil-date queues, contact replay,
archival retaining history while clearing the next step, future contacts and past next steps.
Extended role gates and added form contracts. Per the user's instruction, no lint, tests,
typecheck or build ran locally; these remain for CI. Commit formatting/whitespace checks passed.

The richer commercial seed has been authored but has not yet replaced the live dataset. The
browser flows above used a new local demonstration lead against the existing 250-student seed.

## Shared filters refinement — 2026-10-11

Replaced the two segmented rows with the design system's TableFilters/TableFilterChips, matching
Turmas and Professores. Situação and Retornos allow combined selections; URL state and pagination
reset are preserved. The API uses union within each group and intersection with the name search.

Browser selected Hoje + Em atraso and displayed 12 leads (six due today and six overdue) from the
20 active candidates. Inspected desktop 1280×900 and narrow 390×844; filters wrap and active chips
use the shared horizontal scroller. Screenshots: filters-desktop.png and filters-mobile.png.
Local checks remain deferred by user instruction. The existing queue integration test was extended
for combined returns and their intersection with search.
