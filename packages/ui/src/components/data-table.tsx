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
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  width?: "wide" | "medium" | "standard" | "narrow" | "selection";
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
  onRetry: () => void;
  /** Activates a data row by pointer or Enter; nested controls keep their own action. */
  onRowClick?: (row: Row) => void;
  empty: { title: string; description: string };
  errorTitle: string;
};

const COLUMN_WIDTHS = {
  wide: 240,
  medium: 192,
  standard: 144,
  narrow: 112,
  selection: 40,
} as const;
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

function isRowControl(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("a, button, input, select, textarea, [role='button'], [role='checkbox']"),
    )
  );
}

function DataRow<Row extends { id: string }>({
  row,
  columns,
  onRowClick,
}: {
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  onRowClick: DataTableProps<Row>["onRowClick"];
}): ReactElement {
  return (
    <TableRow
      interactive={Boolean(onRowClick)}
      className={
        onRowClick
          ? "cursor-pointer hover:bg-accent focus-within:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          : undefined
      }
      tabIndex={onRowClick ? 0 : undefined}
      onClick={
        onRowClick
          ? (event) => {
              if (event.defaultPrevented || isRowControl(event.target)) return;
              onRowClick(row);
            }
          : undefined
      }
      onKeyDown={
        onRowClick
          ? (event) => {
              if (event.key === "Enter" && !isRowControl(event.target)) {
                event.preventDefault();
                onRowClick(row);
              }
            }
          : undefined
      }
    >
      {columns.map((column) => (
        <TableCell key={column.id} numeric={column.numeric ?? false}>
          {column.cell(row)}
        </TableCell>
      ))}
    </TableRow>
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
        aria-busy={props.updating}
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
              <DataRow key={row.id} row={row} columns={columns} onRowClick={props.onRowClick} />
            ))
          ) : (
            <StateRows {...props} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
