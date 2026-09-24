import {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
} from "../src/components/data-table.js";

type Row = { id: string; name: string; amount: number };
const columns: readonly DataTableColumn<Row>[] = [
  { id: "name", header: "Nome", cell: (row) => row.name },
  { id: "amount", header: "Valor", numeric: true, cell: (row) => row.amount },
];
const props: DataTableProps<Row> = {
  label: "Exemplo",
  columns,
  state: { kind: "data", rows: [{ id: "one", name: "Ana", amount: 10 }] },
  pagination: { page: 1, pageSize: 10, pageCount: 1, totalItems: 1 },
  empty: { title: "Sem dados", description: "Cadastre o primeiro item." },
  errorTitle: "Não foi possível carregar",
  onRetry: () => {},
};

export const tableWithColumns = <DataTable {...props} />;
// @ts-expect-error The operational table owns density; pages cannot shrink its rows.
export const compactTable = <DataTable {...props} density="compact" />;
// @ts-expect-error Pages cannot override the table's styling.
export const restyledTable = <DataTable {...props} className="text-sm" />;
export const restyledPagination: DataTableProps<Row>["pagination"] = {
  ...props.pagination,
  // @ts-expect-error Pagination exposes data and actions, not per-page styling.
  className: "p-0",
};
