# Contract modal implementation

Scope: contract creation only, in student intake and the standalone contract dialog.
Updated: 2026-10-29. The user chose the persistent summary on the left and fields on the right.
Desktop is the priority; narrow rendering is supplemental coverage. Prototypes require an explicit request.
No renewal or student profile redesign is included. Existing financial commands and rules remain in use.

## Implemented

- Four subjects: payer/period, tuition, material, review. Values survive subject navigation.
- Left summary on desktop, collapsible summary above the fields at narrow widths.
- Compact grouping: bounded date/value fields, aligned related controls, and remaining width for names and agreements. Existing semantic tokens and form primitives define the visual system.
- Stable action footer and local validation with focus on the relevant field.
- Invalid controls open ancestor disclosures before focus. Scholarship fields use the design-system Input/Textarea `invalid` prop to expose their error state.
- Tuition preview is independent of unfinished payer or material fields.
- Optional tuition/material scholarships and school conditions use disclosures.
- Material acquisition lists books before payment terms, counts only selected books, and shows pass-through amounts separately.
- Intake passes the complete student command, including birth date; `deferStudentValidation` delegates student validation to the intake parent instead of blocking on hidden student fields in the contract subject.
- Standalone student creation exposes the birth date and guardian document already required by the validator.
- Payer copy uses the design-system Tooltip. It names the student or guardian according to the actual source.
- Automatic copy hint: 650 ms entry delay, 4.5 seconds visible, 30-minute cooldown per source type in session storage with an in-memory fallback. Hover remains available.
- The copy icon remains visible after copying or selecting a payer in the creation modal. Selected values reserve space for both clearing and copying.
- Updated user decision: new-payer fields appear immediately and stay expanded after copying. Selecting an existing payer still reuses its record.
- New contract payers require CPF/RG and at least one contact (phone or email), enforced by the shared contract validator.
- Agreement, start and end dates use native date inputs with associated calendars and manual entry.

## Manual browser evidence

Orca embedded browser; actual running application at http://refactor-inicio.lazuli.localhost.
No lint, typecheck, build, test suite, or diff-check commands were run, per the user instruction.

- Desktop capture: `.impeccable/review/contract-setup/desktop.png`, student intake at tuition.
- Supplemental narrow capture: `.impeccable/review/contract-setup/mobile.png`. It uses the actual `/contratos` route in a temporary same-origin iframe, 390 CSS pixels wide, inside Orca. This is viewport evidence, not a native mobile-device capture. No prototype/source route was created.
- Initial narrow inspection found the previous subject scroll position was retained. The form scroll now resets when changing subjects; runtime confirmed scrollTop=0 and visible section heading after advancing.
- Intake: payer copied from student; dates preserved; proceeded through tuition, no acquisition, and review. Final action reached the existing pending-class confirmation, with no contract validation pending. Did not confirm a database write.
- Standalone: partial scholarship agreement validation, full tuition scholarship, two material books, card quote, and empty-book validation were exercised.
- Desktop scholarship error: a 50% scholarship with an empty agreement was manually collapsed before advancing. Validation reopened the disclosure, focused `scholarshipAgreement`, and showed its message and error border. Runtime reported `opened: true`, `focused: scholarshipAgreement`, `invalid: [scholarshipAgreement]`; capture: `.impeccable/review/contract-setup/desktop-scholarship-error.png`.
- Standalone: new student with birth date and full contact; complete student copy stays visible after compact selection. Guardian added with document/contact; copy label switched to guardian, copied the guardian document, and remained visible. Advance to tuition succeeded.
- Tooltip automatic display observed for 4494 ms. Returning immediately to the payer subject did not repeat it. Native mouse-enter interaction reopened the design-system tooltip.
- No horizontal overflow was observed inside the 358-pixel dialog at a 390-pixel viewport. The underlying contract listing has separate pre-existing narrow overflow, outside this task.

## Limits

No new backend behavior or material-future-purchase data model is claimed. Future acquisition commitments, renewal states and student profile states remain separate work. Network-error simulation, exhaustive keyboard coverage and final persistence were not exercised in this UI pass.

The copied-payer guard is supported by the component error contract. No concrete blocked-copy case was reproduced in the browser: the reviewer's initial email/phone-format trigger was unsupported by the actual schema and was withdrawn.

The initial state map is historical; its future material policy and dependency proposals are not implementation claims. Root and `apps/web` copies of `DESIGN.md` and `.impeccable/design.json` are absent. This existing-system extension does not create global visual documentation or change shared tokens.

## Finish review

Reviewer disposition, 2026-10-29: **ship for the two listed findings**.

- Compact copied payer: resolved at the component error contract; errors expand fields and editing keeps them open, subject to the reproduction limit above.
- Collapsed scholarship: resolved through design-system invalid props and opening ancestor disclosures before focus, with the desktop runtime evidence above.

## Follow-up validation

Desktop student intake: empty document/contact blocks continuation; CPF plus email only and CPF plus phone only both advance to tuition. All three contract date inputs expose native date pickers. No lint/check commands or persistence writes were run. Earlier compact-copy review describes the previous behavior; the latest user decision keeps draft fields expanded.
