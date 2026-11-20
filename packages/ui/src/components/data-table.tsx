"use client";

import type { ReactElement, ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Table, TableActionRow, TableBody, TableContainer, TableHeader, TableRow } from "./table";
import { TableCell, TableEmpty, TableHead } from "./table-cells";
import { TablePagination, type TablePaginationConfig } from "./table-pagination";
import { TableSkeleton } from "./table-skeleton";

/** Cell renderers return content, never table markup. Sizing and alignment belong here. */
export type DataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  width?: "wide" | "medium" | "standard" | "narrow" | "selection" | "actions";
};

export type DataTableState<Row> =
  | { kind: "loading" | "error" | "empty" | "noResults" }
  | { kind: "data"; rows: readonly Row[] };

export type DataTableProps<Row extends { id: string }> = {
  label: string;
  columns: readonly DataTableColumn<Row>[];
  state: DataTableState<Row>;
  pagination?: TablePaginationConfig;
  footer?: ReactNode;
  beforeTable?: ReactNode;
  updating?: boolean;
  loadingRows?: number;
  onRetry: () => void;
  /** Activates a data row by pointer or Enter; nested controls keep their own action. */
  onRowClick?: (row: Row) => void;
  /** The row whose detail is open; preserves the shared selection treatment. */
  selectedRowId?: string;
  empty: { title: string; description: string };
  errorTitle: string;
};

const COLUMN_WIDTHS = {
  wide: 240,
  medium: 192,
  standard: 144,
  narrow: 112,
  selection: 40,
  // A 32px icon button plus the standard cell horizontal padding.
  actions: 72,
} as const;
const SKELETON_ROWS = 10;

function StateRows<Row extends { id: string }>({
  state,
  columns,
  onRetry,
  empty,
  errorTitle,
  loadingRows = SKELETON_ROWS,
}: Pick<
  DataTableProps<Row>,
  "state" | "columns" | "onRetry" | "empty" | "errorTitle" | "loadingRows"
>): ReactElement {
  if (state.kind === "loading") {
    return (
      <TableSkeleton
        columns={columns.length}
        rows={loadingRows}
        numericColumns={columns.flatMap((column, index) => (column.numeric ? [index] : []))}
      />
    );
  }
  if (state.kind === "error") {
    return (
      <TableEmpty colSpan={columns.length}>
        <EmptyState
          title={errorTitle}
          description="Verifique a conexão e tente de novo."
          action={
            <Button onClick={onRetry} size="sm" variant="secondary">
              Tentar de novo
            </Button>
          }
        />
      </TableEmpty>
    );
  }
  return (
    <TableEmpty colSpan={columns.length}>
      {state.kind === "noResults" ? (
        <EmptyState
          title="Nenhum resultado encontrado"
          description="Ajuste a busca ou os filtros."
          icon={<SearchX />}
        />
      ) : (
        <EmptyState {...empty} />
      )}
    </TableEmpty>
  );
}

function DataRow<Row extends { id: string }>({
  row,
  columns,
  onRowClick,
  selected,
}: {
  selected: boolean;
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  onRowClick: DataTableProps<Row>["onRowClick"];
}): ReactElement {
  return (
    <TableActionRow selected={selected} onActivate={onRowClick && (() => onRowClick(row))}>
      {columns.map((column) => (
        <TableCell key={column.id} numeric={column.numeric ?? false}>
          {column.cell(row)}
        </TableCell>
      ))}
    </TableActionRow>
  );
}

/** Operational listings share one frame, density, sticky header, states and pagination.
 * Consumers supply columns and data; no density, row markup or styling overrides are exposed.
 */
export function DataTable<Row extends { id: string }>(props: DataTableProps<Row>): ReactElement {
  const { columns, label, state, pagination } = props;
  const minimumWidth = columns.reduce(
    (total, column) => total + COLUMN_WIDTHS[column.width ?? "standard"],
    0,
  );
  return (
    <TableContainer
      viewportBound
      footer={props.footer ?? (pagination ? <TablePagination {...pagination} /> : undefined)}
    >
      {props.beforeTable}
      <Table
        aria-label={label}
        aria-busy={state.kind === "loading" || props.updating}
        className="table-fixed"
        style={{ minWidth: minimumWidth }}
      >
        <TableHeader sticky>
          <TableRow interactive={false}>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                numeric={column.numeric ?? false}
                style={{ width: COLUMN_WIDTHS[column.width ?? "standard"] }}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "data" ? (
            state.rows.map((row) => (
              <DataRow
                key={row.id}
                row={row}
                columns={columns}
                onRowClick={props.onRowClick}
                selected={row.id === props.selectedRowId}
              />
            ))
          ) : (
            <StateRows {...props} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
