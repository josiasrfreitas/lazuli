"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from "react";

import { cn } from "../lib/utils";
import { InlineSkeleton } from "./inline-skeleton";
import { Pagination } from "./pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

type TablePaginationBaseProps = Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
  /** Singular and plural names used by the visible result count. */
  itemLabel?: { singular: string; plural: string };
  /** Current page, 1-based. */
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export type TablePaginationProps = TablePaginationBaseProps &
  (
    | {
        /** Keeps static pagination controls visible while totals load. */
        loading: true;
        pageCount?: never;
        totalItems?: never;
      }
    | { loading?: false; pageCount: number; totalItems: number }
  );

type PageSizeSelectProps = Pick<
  TablePaginationProps,
  "onPageSizeChange" | "pageSize" | "pageSizeOptions"
>;

function PageSizeSelect({
  onPageSizeChange,
  pageSize,
  pageSizeOptions,
}: PageSizeSelectProps): ReactElement {
  return (
    <label className="flex items-center gap-2 text-caption text-muted-foreground">
      Itens por página
      <Select
        items={pageSizeOptions.map((option) => ({ label: String(option), value: option }))}
        onValueChange={(value) => {
          if (value !== null) {
            onPageSizeChange?.(value);
          }
        }}
        value={pageSize}
      >
        <SelectTrigger className="h-11 w-20 sm:h-control-sm" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {pageSizeOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ResultCount({
  itemLabel,
  loading,
  page,
  pageSize,
  totalItems,
}: Pick<TablePaginationBaseProps, "itemLabel" | "page" | "pageSize"> & {
  loading: boolean;
  totalItems: number | undefined;
}): ReactElement {
  const firstItem = !loading && totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = loading ? page * pageSize : Math.min(page * pageSize, totalItems ?? 0);
  const countLabel = totalItems === 1 ? itemLabel?.singular : itemLabel?.plural;

  return (
    <p
      aria-live="polite"
      className="font-numeric text-caption tabular-nums text-muted-foreground"
      data-slot="table-pagination-count"
    >
      {firstItem}–{lastItem} de{" "}
      {loading ? (
        <InlineSkeleton className="w-7" />
      ) : (
        <span className="font-numeric tabular-nums">{totalItems}</span>
      )}{" "}
      {countLabel}
    </p>
  );
}

function PaginationControls({
  loading,
  onPageChange,
  onPageSizeChange,
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
}: Pick<TablePaginationBaseProps, "page" | "pageSize" | "pageSizeOptions"> & {
  loading: boolean;
  onPageChange: ((page: number) => void) | undefined;
  onPageSizeChange: ((pageSize: number) => void) | undefined;
  pageCount: number | undefined;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
      <PageSizeSelect
        {...(onPageSizeChange === undefined ? {} : { onPageSizeChange })}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
      />
      <Pagination
        {...(onPageChange === undefined ? {} : { onPageChange })}
        page={page}
        {...(loading ? { loading: true } : { pageCount: pageCount ?? 0 })}
      />
    </div>
  );
}

/**
 * Pagination furniture for a `TableContainer`'s `footer`. It keeps result
 * context, page navigation and page-size configuration together as part of
 * the table API.
 */
export const TablePagination = forwardRef<HTMLDivElement, TablePaginationProps>(
  (
    {
      className,
      itemLabel = { singular: "item", plural: "itens" },
      loading = false,
      onPageChange,
      onPageSizeChange,
      page,
      pageCount,
      pageSize,
      pageSizeOptions,
      totalItems,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        {...props}
        className={cn(
          "flex shrink-0 flex-col gap-3 border-t border-border bg-card px-4 py-2 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
        data-slot="table-pagination"
        ref={ref}
      >
        <ResultCount
          itemLabel={itemLabel}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
        />
        <PaginationControls
          loading={loading}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
        />
      </div>
    );
  },
);

TablePagination.displayName = "TablePagination";
