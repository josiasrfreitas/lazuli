# Operational table API

Use `DataTablePage` for page furniture and `DataTable` for standard operational listings.
Both compose the existing primitives in `packages/ui`; product pages supply content and state.
Alunos and Recebíveis remain the visual references. This change adopts the API in Contratos;
it does not redesign or replace the other listings' specialized interactions/grouping.

```tsx
<DataTablePage title="Contratos" summary="Acordos mensais" controls={<ContractsToolbar />}>
  <DataTable
    label="Contratos mensais"
    columns={columns}
    state={state}
    pagination={pagination}
    empty={{ title: "Nenhum contrato cadastrado", description: "Crie o primeiro contrato." }}
    errorTitle="Não foi possível carregar os contratos"
    onRetry={refetch}
  />
</DataTablePage>
```

`DataTableColumn<Row>` declares a stable ID, header label, cell-content renderer, optional
numeric alignment and optional width role (`wide`, `standard`, `narrow`). Cell renderers return
content, not `tr`, `td` or `th`. Row IDs come from the data, never the array index.

`DataTableState<Row>` is explicit: `loading`, `error`, `empty`, `noResults`, or `data` with rows.
The component owns the skeleton, empty/error presentation and retry action. Pagination receives
only values and callbacks through `TablePaginationConfig`; it stays outside the scroll viewport.

The shared component owns the default 48 px minimum cell height, horizontal padding, typography,
fixed column layout, sticky header, scroll frame and footer. Wrapped content may increase row
height; a page cannot choose compact density or override table/frame/pagination styles.
Columns and their widths remain the same across data, loading and empty states.

`DataTablePage` owns title and summary composition. Product pages provide text/counts, not a
custom header element. Filters and actions remain controlled by the page.

Do not add styling escape hatches to accommodate a single screen. Extend the shared API only
when a concrete repeated behavior requires it, with a Storybook example and contract coverage.

Use `onRowClick={(row) => ...}` for listings that open a detail page. The shared component
provides a pointer cursor, subtle whole-row hover/focus feedback, and Enter activation on
the focused row. Links, buttons, form fields, and selection controls inside a row keep their
own interaction. Informational tooltip triggers may render as spans so clicking their text
also activates the row. Header, loading, empty, and error rows remain noninteractive.

For a list beside its detail, pass `selectedRowId` with the ID of the open row. The shared table
owns the whole-row background, inset outline and `aria-selected`; changing selection remains
controlled through `onRowClick`. Focus feedback stays distinct from the persistent selection.

`TableFilters` includes the compact “Filtros ativos” disclosure and its clear-all control.
Do not render a second `TableFilterChips` row above results. The disclosure opens on hover
or activation and portals its removable selections without changing the table's height.

Table frames share a short entrance; skeleton rows and busy tables share the diagonal loading
sweep. Keep initial loading inside `DataTable` (or `TableSkeleton` for existing composed tables)
instead of replacing the frame with a spinner. Reduced-motion preferences retain static loading
placeholders, and background refreshes preserve readable rows and pagination.
