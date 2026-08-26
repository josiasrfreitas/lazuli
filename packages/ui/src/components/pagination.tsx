"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";

export type PaginationProps = Omit<ComponentPropsWithoutRef<"nav">, "onChange"> & {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  onPageChange?: (page: number) => void;
  /** Accessible name of the navigation landmark. */
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
};

/**
 * Previous/next pager with a "page X of Y" indicator. Presentational: the
 * caller owns the page state and clamps it; the buttons only disable at the
 * edges reported through `page`/`pageCount`.
 */
export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  (
    {
      className,
      label = "Paginação",
      nextLabel = "Próxima página",
      onPageChange,
      page,
      pageCount,
      previousLabel = "Página anterior",
      ...props
    },
    ref,
  ) => {
    const totalPages = Math.max(pageCount, 1);

    return (
      <nav
        {...props}
        aria-label={label}
        className={cn("flex items-center gap-3", className)}
        data-slot="pagination"
        ref={ref}
      >
        <Button
          aria-label={previousLabel}
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className="text-caption text-muted-foreground" data-slot="pagination-status">
          Página <span className="font-numeric tabular-nums">{page}</span> de{" "}
          <span className="font-numeric tabular-nums">{totalPages}</span>
        </p>
        <Button
          aria-label={nextLabel}
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    );
  },
);

Pagination.displayName = "Pagination";
