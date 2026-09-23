# Build Tasks: Table Filters

Generated from: the shared understanding reached on 2026-09-22, with context from
`.design/parcelas/DESIGN_BRIEF.md` and `.design/alunos/DESIGN_BRIEF.md`.

This new request expands the older Parcelas brief, which excluded period filters. It applies to
both implemented listings. Search remains a separate, combinable control. Values selected within
one field use OR; different fields, search, and the Vencidas view use AND. All filter state lives in
the URL through nuqs, and every valid change applies immediately and resets pagination.

## Contract and proposed defaults

- Parcelas has no status tabs. All statuses, including Vencida and Paga, live in Situação; an empty
  selection shows Todas. Selecting only Vencida uses the grouped overdue view. Combined selections
  use the flat list and return the union of the selected situations.
- Parcelas filters: Situação, Vencimento, Valor. Pagador and Beneficiário remain covered by text search. Vencidas shows only overdue
  installments that match a due-date period and recomputes each payer group's summary from them.
- Alunos removes its status tabs. Filters: Situação, Turma, Professor, Data de cadastro.
- Each table configures its own promoted controls. The proposed starting configuration is Situação
  and Vencimento inline in Parcelas, and Situação and Turma inline in Alunos. Mais filtros exposes
  only secondary fields; a promoted field appears solely in the inline controls.
- A date period has optional start and end boundaries. Parcelas uses its civil due date; Alunos uses
  the registration date in America/Sao_Paulo. A one-day period sets both boundaries to that day.
- The proposed Valor contract uses the installment's original BRL amount in both Parcelas views;
  the grouped Vencida summary continues to display collectible balance. Keeping the filter meaning
  stable across presentations avoids the same URL selecting different amounts.
- Filter options may be multiselected. A value range and a date period each define one condition
  with optional lower and upper boundaries. Empty selections are omitted from the URL and query.
- Results, totals, pagination, active-filter summaries, and empty states must agree with the
  effective server query. The existing text-search behavior in Vencidas still qualifies a payer
  and shows all of that payer's overdue installments within the selected due-date period.

## Build order

- [ ] **1. Deliver the shared filter control through Parcelas Situação**: create a presentational
      table-filter composition in `packages/ui` with configurable inline fields, a Mais filtros panel,
      multiselect options, active summaries, per-field clear and clear-all. Show applied filters as
      removable chips directly above results in one horizontally scrolling row. Condense categories
      with many selections and let users remove individual values from the chip's menu. Keep the
      icon-only global X inside the segmented Mais filtros control so it stays visible during panel
      scrolling without increasing panel height; distinguish it by position and accessible name
      from each field's X. Reuse `Button`, `Popover`,
      `Select`/checkbox primitives, tokens, and the existing `DataTablePage` controls slot. Connect
      Parcelas Situação to nuqs and the server query, remove the status tabs, and preserve old
      `status=pagas` links by normalizing them into the new filter state. Done = Paga and another
      situation can be selected together; their union is returned, the URL is shareable, and the
      search control remains independent. Add a component story and behavior tests for keyboard,
      focus, and clear actions. _Creates the shared filter composition; modifies Parcelas controls,
      URL logic, validation, and read query._

- [ ] **2. Filter Parcelas by Vencimento, including grouped Vencidas**: extend the same composition
      with a date-period editor and integrate optional due-date boundaries from nuqs through the
      validated API input into both flat and grouped SQL queries. Apply the period before payer grouping
      and pagination, then recompute group balance, count, and oldest delay from matching rows. Keep
      the existing payer-qualification behavior of text search within that period. Done = changing
      either boundary updates results immediately, an invalid interval cannot trigger a misleading
      query, and no group is split or counted from rows outside the period. _Modifies the shared
      composition, Parcelas feature, validators, and finance read query; reuses existing date formatting
      and group presentation._

- [ ] **3. Complete Parcelas's secondary filter**: add Valor as an optional BRL amount range in
      Mais filtros using the shared CurrencyInput, whose controlled value is integer centavos and
      whose display uses `R$`, comma decimals, and dot thousands. Apply it with the other filters
      before counts and pagination. In Vencidas, the
      range narrows overdue installments before grouping, and summaries use only the displayed
      installments. Done = the amount range combines with situation, due date, and search, with
      correct groups and totals. _Modifies Parcelas feature, validation, and finance read query;
      reuses the shared filter composition._

- [ ] **4. Move Alunos's situation tabs into the shared filter**: use the shared composition with
      Situação and Turma promoted inline; expose only secondary fields in Mais filtros. Replace the
      status tabs with a multiselect Situação filter, add multiselect Turma, and connect both to nuqs
      and `students.list` before pagination and counts. Normalize old `status=ativos|inativos` links.
      Done = active and inactive together behave like the union of those states, one class or several
      can be selected, search combines by AND, and the URL survives refresh/back navigation. _Modifies
      Alunos controls, URL logic, validators, and read query; reuses the shared filter composition._

- [ ] **5. Complete Alunos's secondary filters**: add multiselect Professor and an optional
      Data de cadastro period in Mais filtros. Filter registration timestamps by São Paulo civil-day
      boundaries on the server, before pagination. Professor and Turma use a searchable remote
      multiselect with selectable rows and checkmarks, not checkbox grids. Keep selected labels
      independent of search results. Open the selector with only its search field and an instruction;
      fetch and show options only after the user types a nonempty query. Show the first 20 matching
      options and indicate when more exist. Distinguish loading, empty, and retryable error states. Populate current professor
      options from authorized data. Done = either date boundary works alone, selecting two professors uses OR, and combining
      professor, class, situation, registration period, and search uses AND with correct totals. _Modifies
      Alunos feature, option queries, validation, and read query; reuses the shared date-period editor._

- [ ] **6. Verify states, responsiveness, and accessibility in both listings**: check 1280, 768,
      and 375 px with long labels, several active values, empty results, loading, error/retry, browser
      back/forward, and a shared URL. Ensure inline controls wrap without covering search or actions;
      More filters remains usable by keyboard and screen reader, exposes selected values, and returns
      focus when closed. Keep active filters visible when the panel closes and provide clear-all without
      clearing search. _Modifies only compositions that need correction; reuses
      current table states, focus tokens, and responsive shell._

## Verification per slice

- Before each code slice, load `ship-with-tests` and follow `docs/testing/README.md`. Protect
  URL normalization and filter combination with unit tests; use integration tests for SQL filters,
  counts, grouped summaries, date boundaries, and pagination. Add transport coverage only where
  serialization or authorization changes. Use observable component interaction tests for the
  filter control; a static render alone does not prove keyboard or immediate application.
- At completion, inspect the full diff and run `git diff --check`, format, lint, typecheck, affected
  unit/integration tests, and relevant build gates. State concretely which checks remain for CI.

## Review

- [ ] **Design review**: compare both finished toolbars with the agreed progressive disclosure
      behavior and the existing Lazuli tokens, including the special Vencidas view. _Reuses the current
      briefs as visual context; this checklist records the newly agreed filtering behavior._
