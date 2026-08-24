"use client";

import { type ComponentProps, forwardRef, type ReactElement } from "react";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "../lib/utils";
import { tableCellSpacing, useTableDensity } from "./table";

export type TableSortDirection = "ascending" | "descending";

function sortIconFor(direction: TableSortDirection | undefined): typeof ChevronsUpDown {
  if (direction === "ascending") {
    return ArrowUp;
  }

  if (direction === "descending") {
    return ArrowDown;
  }

  return ChevronsUpDown;
}

function TableSortIcon({ direction }: { direction: TableSortDirection | undefined }): ReactElement {
  const Icon = sortIconFor(direction);

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", !direction && "opacity-disabled")}
      data-slot="table-sort-icon"
    />
  );
}

/** Column-label typography, shared by the header cell and its sort button. */
const tableHeadLabel = "text-micro font-semibold tracking-label uppercase";

export type TableHeadProps = ComponentProps<"th"> & {
  /** Right-aligns the column for currency, counts and dates. */
  numeric?: boolean;
  /** Renders the column label as a sort control and reserves room for its icon. */
  onSort?: () => void;
  /** Current sort of this column; drives `aria-sort` and the icon direction. */
  sortDirection?: TableSortDirection;
};

/**
 * A column header. When `onSort` is given, the header renders its own sort
 * button and direction icon, so a sortable column never depends on the
 * consumer reproducing the control.
 */
export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  (
    { children, className, numeric = false, onSort, scope = "col", sortDirection, ...props },
    ref,
  ) => {
    const spacing = tableCellSpacing[useTableDensity()];

    return (
      <th
        {...props}
        aria-sort={onSort ? (sortDirection ?? "none") : undefined}
        className={cn(
          spacing,
          "text-left align-middle whitespace-nowrap text-muted-foreground",
          tableHeadLabel,
          numeric && "text-right",
          onSort && "p-0",
          className,
        )}
        data-slot="table-head"
        ref={ref}
        scope={scope}
      >
        {onSort ? (
          <button
            className={cn(
              spacing,
              // The button does not inherit the header's label typography from
              // the `th`, so it has to repeat it or the column reads unstyled.
              tableHeadLabel,
              "inline-flex w-full items-center gap-1.5 rounded-sm text-inherit",
              "transition-colors duration-fast ease-standard hover:text-foreground",
              "focus-visible:outline-none focus-visible:shadow-focus",
              numeric && "justify-end",
            )}
            data-slot="table-sort-button"
            onClick={onSort}
            type="button"
          >
            {children}
            <TableSortIcon direction={sortDirection} />
          </button>
        ) : (
          children
        )}
      </th>
    );
  },
);

TableHead.displayName = "TableHead";

export type TableCellProps = ComponentProps<"td"> & {
  /** Right-aligns and tabular-aligns the value for currency, counts and dates. */
  numeric?: boolean;
};

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric = false, ...props }, ref) => (
    <td
      {...props}
      className={cn(
        tableCellSpacing[useTableDensity()],
        "align-middle text-foreground",
        // Currency and dates must never wrap mid-value.
        numeric && "text-right whitespace-nowrap tabular-nums",
        className,
      )}
      data-slot="table-cell"
      ref={ref}
    />
  ),
);

TableCell.displayName = "TableCell";

export type TableEmptyProps = ComponentProps<"td"> & {
  /** Must span every column so the message stays centred in the table frame. */
  colSpan: number;
};

/**
 * A full-width message row for the empty, no-results and error states. It keeps
 * those states inside the table boundary instead of replacing it, so the
 * surrounding layout does not jump. Loading uses `TableSkeleton` instead, which
 * preserves the column widths.
 */
export const TableEmpty = forwardRef<HTMLTableCellElement, TableEmptyProps>(
  ({ className, ...props }, ref) => (
    <tr data-slot="table-empty-row">
      <td
        {...props}
        className={cn(
          "h-40 px-5 text-center align-middle text-caption text-muted-foreground",
          className,
        )}
        data-slot="table-empty"
        ref={ref}
      />
    </tr>
  ),
);

TableEmpty.displayName = "TableEmpty";
