"use client";

import { type ReactElement } from "react";

import { cn } from "../lib/utils";
import { tableCellSpacing, useTableDensity } from "./table";

// Placeholder bars are deliberately uneven so a loading table reads like rows
// of real data instead of a grid. The cycles are indexed, never random, so the
// server and client render the same markup.
const barWidths = ["w-40", "w-24", "w-20", "w-28", "w-16"];
const rowDelays = ["", "[animation-delay:120ms]", "[animation-delay:240ms]"];

/** Placeholder rows drawn when the caller does not choose a count. */
const defaultSkeletonRows = 3;

function skeletonBarWidth(column: number, numeric: boolean): string {
  if (numeric) {
    return "w-16";
  }

  return barWidths[column % barWidths.length] ?? "w-24";
}

export type TableSkeletonProps = {
  /** Number of placeholder cells per row; must match the header's columns. */
  columns: number;
  /**
   * Announced while the rows are placeholders. The bars themselves are hidden
   * from assistive technology, so this is the only thing read out.
   */
  label?: string;
  /** Columns rendered as short, right-aligned bars, by zero-based index. */
  numericColumns?: number[];
  /** Placeholder rows to draw. Keep it close to the usual page size. */
  rows?: number;
};

/**
 * Animated placeholder rows for the loading state. It renders real `tr`/`td`
 * elements so the columns keep their widths and the table does not resize when
 * the data arrives.
 */
export function TableSkeleton({
  columns,
  label = "Carregando dados da tabela…",
  numericColumns = [],
  rows = defaultSkeletonRows,
}: TableSkeletonProps): ReactElement {
  const spacing = tableCellSpacing[useTableDensity()];

  return (
    <>
      <tr className="sr-only" data-slot="table-skeleton-status">
        <td colSpan={columns} role="status">
          {label}
        </td>
      </tr>
      {Array.from({ length: rows }, (__, row) => (
        <tr
          className="border-b border-border"
          data-slot="table-skeleton-row"
          key={`skeleton-row-${row}`}
        >
          {Array.from({ length: columns }, (__, column) => {
            const numeric = numericColumns.includes(column);

            return (
              <td
                aria-hidden="true"
                className={cn(spacing, "align-middle")}
                data-slot="table-skeleton-cell"
                key={`skeleton-cell-${column}`}
              >
                <span
                  className={cn(
                    "block h-3 max-w-full rounded-full bg-muted-foreground/20",
                    "animate-pulse motion-reduce:animate-none",
                    rowDelays[row % rowDelays.length],
                    skeletonBarWidth(column, numeric),
                    numeric && "ml-auto",
                  )}
                  data-slot="table-skeleton-bar"
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
