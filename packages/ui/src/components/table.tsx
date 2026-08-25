"use client";

import { type ComponentProps, createContext, forwardRef, useContext } from "react";

import { cn } from "../lib/utils";

export type TableDensity = "compact" | "default";

// Density is chosen once on the root and read by the cells, so a header and its
// body cannot drift to different row heights or paddings.
const TableDensityContext = createContext<TableDensity>("default");

/** Row height and horizontal cell padding, per density. */
export const tableCellSpacing: Record<TableDensity, string> = {
  compact: "h-10 px-3",
  default: "h-12 px-5",
};

export function useTableDensity(): TableDensity {
  return useContext(TableDensityContext);
}

export type TableContainerProps = ComponentProps<"div">;

/**
 * The table's visible boundary. It owns the horizontal scroll so a wide table
 * never widens the page, and it keeps empty, loading and error states inside
 * the same frame as the data.
 */
export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      // `relative` anchors absolutely-positioned descendants (e.g. `sr-only`
      // labels in cells) inside the scroll area; without it they sit on the
      // page itself, widening it by the table's off-screen width.
      className={cn(
        "relative w-full overflow-x-auto rounded-lg border border-border bg-card scrollbar-subtle",
        className,
      )}
      data-slot="table-container"
      ref={ref}
    />
  ),
);

TableContainer.displayName = "TableContainer";

export type TableProps = ComponentProps<"table"> & {
  /** Row height and cell padding shared by every cell in this table. */
  density?: TableDensity;
};

/**
 * Semantic tabular data. Wrap it in `TableContainer`, and give it a
 * `TableCaption` or an `aria-label` so the table is announced.
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, density = "default", ...props }, ref) => (
    <TableDensityContext.Provider value={density}>
      <table
        {...props}
        // The minimum width is what makes the container's scroll deliberate:
        // without it a narrow viewport crushes every column instead of
        // scrolling. Override it per table when the columns need more room.
        className={cn("w-full min-w-lg caption-bottom border-collapse text-caption", className)}
        data-density={density}
        data-slot="table"
        ref={ref}
      />
    </TableDensityContext.Provider>
  ),
);

Table.displayName = "Table";

export type TableHeaderProps = ComponentProps<"thead">;

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => (
    <thead
      {...props}
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
      data-slot="table-header"
      ref={ref}
    />
  ),
);

TableHeader.displayName = "TableHeader";

export type TableBodyProps = ComponentProps<"tbody">;

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody
      {...props}
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      ref={ref}
    />
  ),
);

TableBody.displayName = "TableBody";

export type TableFooterProps = ComponentProps<"tfoot">;

export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => (
    <tfoot
      {...props}
      className={cn("border-t border-border bg-muted font-semibold [&_tr]:border-0", className)}
      data-slot="table-footer"
      ref={ref}
    />
  ),
);

TableFooter.displayName = "TableFooter";

export type TableRowProps = ComponentProps<"tr"> & {
  /** Marks the row as picked by a selection control; also sets `aria-selected`. */
  selected?: boolean;
};

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, ...props }, ref) => (
    <tr
      {...props}
      aria-selected={selected || undefined}
      className={cn(
        "border-b border-border transition-colors duration-fast ease-standard",
        "hover:bg-muted data-[selected]:bg-accent",
        className,
      )}
      data-selected={selected || undefined}
      data-slot="table-row"
      ref={ref}
    />
  ),
);

TableRow.displayName = "TableRow";

export type TableCaptionProps = ComponentProps<"caption">;

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption
      {...props}
      className={cn("px-5 py-3 text-left text-caption text-muted-foreground", className)}
      data-slot="table-caption"
      ref={ref}
    />
  ),
);

TableCaption.displayName = "TableCaption";
