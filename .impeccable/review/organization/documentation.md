# Organization: design-system documentation decision

Date: 2026-10-18. Scope: `apps/web/src/features/class-organization` and its existing student-intake and form integrations.

This is an ordinary extension of Lazuli's authenticated operational interface. Source inspection supports preserving the incumbent visual system. No new palette, font family, shared scale, or global visual doctrine is warranted. Root `DESIGN.md` and `.impeccable/design.json` are absent in this worktree; this pass leaves them absent rather than creating a competing authority. Only this report is written.

## Evidence consulted

- Product and authority: `PRODUCT.md`, `docs/frontend/README.md`, the accepted decisions and parallel-work handoff under `tmp/operacao-pedagogica/`, and Impeccable's `reference/document.md`.
- Incumbent system: `packages/ui/src/styles/tokens/{color,typography,scale}.css`, shared `styles/globals.css`, `components/button.tsx`, and `apps/web/src/app/globals.css`.
- Finished surface: `class-organization/organization.module.css`, `page.tsx`, `agenda.tsx`, `weekly-schedule.tsx`, `review.tsx`, `calendar-forms.tsx`, `dialogs.tsx`, and `renewal.tsx`.
- Existing form continuity: `semester-organization/plan-form.tsx`, `students/new-student/new-student-dialog.tsx`, `dados-step.tsx`, `finance-step.tsx`, and `pedagogy-step.tsx`.

## Five-line system summary

1. Palette: existing navy headings/actions and cool neutral surfaces; source reference navy is `#0f1e3d`, canvas `#f5f6f7`, and card white. Feature styling consumes semantic roles, including `interactive`, `warning`, `border`, and `muted`.
2. Type: inherited Cambria/Georgia/Times body and display stack; numeric calendar cells use the incumbent Calibri/Segoe UI stack. Observed hierarchy uses h3 (1.1875rem), caption (0.8125rem), and micro (0.6875rem); controls inherit the shared control role (0.84375rem).
3. Action hierarchy: shared primary/secondary/ghost buttons keep ordinary work prominent; semester setup moves into a contextual options popover. Selection actions sit outside scrolling detail content.
4. Layout: compact borders and tonal surfaces separate a recurring schedule and context panel; 350px context narrows to 310px, then mobile switches between schedule and context at 760px. These are local composition facts, not shared-system tokens.
5. Forms and depth: shared TaskDialog, TextControl, SelectControl, Checkbox, Button, and existing contract/intake components retain the incumbent field and modal language; surface separation is predominantly flat borders and semantic fills.

## Implemented review corrections visible in source

- Mobile has explicit “Horários” and context switches; selecting a class opens its composition context. The active workspace hides the other surface instead of forcing the user below a full-height schedule.
- The page heading uses h3; narrow header actions occupy their own row and the period selector is compact.
- “Revisar alocação e estágio” is in a non-scrolling footer for the selected student; the queue and contextual detail retain independent scroll regions.
- “Incorporar base” and “Novo semestre” appear inside the setup popover. The ordinary header presents primary student entry and secondary class creation.
- Student intake opens the existing NewStudentDialog, with pedagogy inside its established flow. Renewal reuses ContractFormFields and the existing contract form state.

These statements describe implementation evidence, not proof of final rendered behavior or successful transactions.

## Drift and limitations not canonized

The initial source inspection found undefined h4 references in the context and review headings. The implementer corrected both to the existing body role: `--lz-text-body` in the context heading and `text-body` in the review heading. A subsequent source read confirmed these corrections. No new type role was introduced, and this documentation pass made no source repair.

The recurring schedule is a local table grouped by start time, explicitly documenting that height does not encode lesson duration. The before/after review is also a local table. These compositions are not promoted into replacements for the frontend guide's shared ScheduleCalendar and DataTable contracts. Whether their special-purpose behavior warrants an exception remains a surface-level implementation question.

The existing Cambria display stack is a confirmed incumbent choice, not a new Impeccable recommendation. Local table styles, microcopy density, and responsive dimensions likewise do not become global rules merely because this surface uses them.

Existing captures are available as `desktop.png`, `mobile.png`, `calendar.png`, `intake.png`, and `renewal.png` in this directory. They were not independently inspected in this documentation pass and do not establish final-state validation. The coordinator reports that the parallel materials import error has been fixed, the browser has recovered, and final recaptures are in progress. This report makes no browser-validation claim.

No tests, checks, detector, lint, typecheck, build, or browser commands were run in this pass, following the delegated boundary and the user's prohibition on automated validation. No shared system, product source, or parallel materials files were edited.

## Coordinator final evidence update

Final Orca captures replaced desktop.png and mobile.png; mobile-day.png, mobile-queue.png, and
review.png supplement them. The finish reviewer inspected the four agenda/context corrections
and returned `disposition: ship`, explicitly limited to that surface. All four reported material
issues were resolved. This does not extend approval to renewal persistence or other unreviewed
flows. The coordinator exercised bulk future-effective transfers, confirmed the source enrollment
remained current in the student profile, and undid both demo publications. Two unconfirmed demo
proposals remain. No automated checks or tests were run.
