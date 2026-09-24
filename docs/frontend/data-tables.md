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
