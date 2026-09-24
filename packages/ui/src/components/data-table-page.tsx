import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "../lib/utils";

export type DataTablePageProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "title"> & {
  /** Visible page heading; typography and alignment belong to this layout. */
  title: string;
  /** Optional inline description or live counts, beside the title when space allows. */
  summary?: ReactNode;
  /** Search, tabs, primary action and other controls that must remain visible. */
  controls?: ReactNode;
  /** A table frame that owns the remaining viewport and its scroll. */
  children: ReactNode;
};

/**
 * Viewport-bound layout for operational listings. Page furniture never
 * scrolls; the table frame receives all remaining height and owns overflow.
 *
 * Header and controls share a single toolbar row so the data starts as high
 * as possible: the header sits at the start, the controls at the end, and the
 * controls wrap under the header only when the row runs out of room.
 */
export const DataTablePage = forwardRef<HTMLDivElement, DataTablePageProps>(
  ({ children, className, controls, title, summary, ...props }, ref) => (
    <div
      {...props}
      className={cn(
        "mx-auto flex h-full min-h-0 w-full max-w-[96rem] flex-col gap-4 overflow-hidden p-6",
        className,
      )}
      data-slot="data-table-page"
      ref={ref}
    >
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3"
        data-slot="data-table-page-toolbar"
      >
        <div
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          data-slot="data-table-page-header"
        >
          <h1 className="font-display text-h2 font-semibold text-foreground">{title}</h1>
          {summary === undefined ? null : (
            <p className="text-caption text-muted-foreground">{summary}</p>
          )}
        </div>
        {controls === undefined ? null : <div data-slot="data-table-page-controls">{controls}</div>}
      </div>
      <div className="min-h-0 flex-1" data-slot="data-table-page-content">
        {children}
      </div>
    </div>
  ),
);

DataTablePage.displayName = "DataTablePage";
