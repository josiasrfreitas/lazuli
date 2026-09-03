"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { InlineSkeleton } from "./inline-skeleton";

type PaginationBaseProps = Omit<ComponentPropsWithoutRef<"nav">, "onChange"> & {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages. */
  onPageChange?: (page: number) => void;
  /** Accessible name of the navigation landmark. */
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
};

export type PaginationProps = PaginationBaseProps &
  (
    | {
        /** Renders the unknown page count as an inline skeleton. */ loading: true;
        pageCount?: never;
      }
    | { loading?: false; pageCount: number }
  );

function PaginationStatus({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number | undefined;
}): ReactElement {
  return (
    <p className="text-caption text-muted-foreground" data-slot="pagination-status">
      Página <span className="font-numeric tabular-nums">{page}</span> de{" "}
      {totalPages === undefined ? (
        <InlineSkeleton className="w-5" />
      ) : (
        <span className="font-numeric tabular-nums">{totalPages}</span>
      )}
    </p>
  );
}

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
      loading = false,
      previousLabel = "Página anterior",
      ...props
    },
    ref,
  ) => {
    const totalPages = loading ? undefined : Math.max(pageCount ?? 0, 1);

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
          className="size-11 sm:size-8"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <PaginationStatus page={page} totalPages={totalPages} />
        <Button
          aria-label={nextLabel}
          className="size-11 sm:size-8"
          disabled={totalPages === undefined || page >= totalPages}
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
