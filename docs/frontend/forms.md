# Form standard

Every product form in `apps/web` (dialogs, wizards, edit panels) follows this contract. It exists
because the first version of the "Novo aluno" wizard shipped through a full design review with no
placeholders, a native date picker that ate four Tab presses, focus opening on the close button, and
Enter doing nothing. None of those are visible in a screenshot; all of them are visible to the
secretary on the first call. The rules below are the ones that catch that class of defect.

The reference implementation is the Storybook story `Patterns/DenseForm`. New forms start from it.

## Contract

**Structure**

- One real `<form>` per step, with `noValidate` and an `onSubmit` handler. Enter in any text field
  submits. A footer outside the scrolling body submits via `<Button form={id} type="submit">`.
- Fields are chunked with `FormSection` (a `fieldset` with a visible legend) and laid out with
  `FormRow`. Multi-column rows are for short, related fields only (phone/email, date/document).
- Order fields by decision, not by data model: a field whose value changes what comes next (the
  birth date decides whether a guardian is required) sits before the fields it affects.
- Secondary and conditional groups are collapsed until needed (`FormSection` with an `action`),
  and open automatically when a rule requires them.

**Controls**

- Every text control has a `placeholder` that shows the expected format (`dd/mm/aaaa`,
  `(11) 99999-9999`, `nome@exemplo.com`), a `name`, and `autoComplete="off"`. The secretary's own
  browser profile must never autofill a student's record.
- Dense forms use `size="sm"` controls and `text-caption` labels (the `Label` default).
- Dates are masked text, never `type="date"`: the native picker is three or four Tab stops and has
  no placeholder. Use `maskDateBR` / `parseDateBR` from `~/lib/masks`.
- Phones are masked with `maskPhoneBR`; `inputMode="tel"` / `"numeric"` on numeric fields.
- Up to five options render as `SegmentedControl` pills, not a `Select`.

**Keyboard**

- Opening a dialog form focuses the first field (`initialFocus` on `DialogContent`), not the close
  button.
- Tab order is strictly left-to-right, top-to-bottom, one stop per control. Count the stops.
- Escape closes; the pending-submit guard from `NewStudentDialog` applies to any mutation.

**Validation**

- Client validation runs on submit and clears per field on edit; messages render in `FieldError`
  next to the control and the first invalid control scrolls into view and takes focus
  (`useScrollToError`).
- Error state uses border plus text, never color alone.
- The server stays the authority; its field errors map back onto the same `FieldError` slots.

## Enforcement

| Layer                            | What it catches                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/web/test/*-form-contract*` | Per form: every input has placeholder + name + autocomplete off, no `type="date"`, one `<form>`, no combobox |
| `Patterns/DenseForm` play test   | Tab walk (one stop per control) and Enter submit on the reference form                                       |
| Design review checklist (below)  | Focus on open, Tab count, Enter, scroll-free at 1280×800, placeholders visible                               |

When you add a form, add its `*-form-contract.test.ts` alongside the reducer/view-model tests. The
"Novo aluno" one (`new-student-form-contract.test.ts`) is the template: render to static markup and
assert attributes, no DOM needed.

## Design review checklist for forms

Run these in the browser with chrome-devtools before calling a form done. Screenshots alone pass
forms that fail all five.

1. Open the form. Where is focus? It must be on the first field.
2. Press Tab through the whole form and count stops. One per control; note any control that takes
   more than one.
3. Type in the first field and press Enter. It must submit (validate or advance).
4. Measure the dialog body: `scrollHeight <= clientHeight` at 1280×800 for the default state.
5. Every empty control shows a placeholder; every masked field formats as you type.
