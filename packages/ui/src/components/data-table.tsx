"use client";

import type { ReactElement, ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Table, TableBody, TableContainer, TableHeader, TableRow } from "./table";
import { TableCell, TableEmpty, TableHead } from "./table-cells";
import { TablePagination, type TablePaginationConfig } from "./table-pagination";
import { TableSkeleton } from "./table-skeleton";

/** Cell renderers return content, never table markup. Sizing and alignment belong here. */
export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  width?: "wide" | "standard" | "narrow";
};

export type DataTableState<Row> =
  | { kind: "loading" | "error" | "empty" | "noResults" }
  | { kind: "data"; rows: readonly Row[] };

export type DataTableProps<Row extends { id: string }> = {
  label: string;
  columns: readonly DataTableColumn<Row>[];
  state: DataTableState<Row>;
  pagination: TablePaginationConfig;
  onRetry: () => void;
  empty: { title: string; description: string };
  errorTitle: string;
};

const COLUMN_WIDTHS = { wide: 240, standard: 144, narrow: 112 } as const;
const SKELETON_ROWS = 10;

function StateRows<Row extends { id: string }>({
  state,
  columns,
  onRetry,
  empty,
  errorTitle,
}: Pick<
  DataTableProps<Row>,
  "state" | "columns" | "onRetry" | "empty" | "errorTitle"
>): ReactElement {
  if (state.kind === "loading") {
    return (
      <TableSkeleton
        columns={columns.length}
        rows={SKELETON_ROWS}
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
    <TableContainer viewportBound footer={<TablePagination {...pagination} />}>
      <Table aria-label={label} className="table-fixed" style={{ minWidth: minimumWidth }}>
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
              <TableRow key={row.id} interactive={false}>
                {columns.map((column) => (
                  <TableCell key={column.id} numeric={column.numeric ?? false}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <StateRows {...props} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
