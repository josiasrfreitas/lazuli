import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "../lib/utils";

export type DataTablePageProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** Title, summary and primary action for the listing. */
  header: ReactNode;
  /** Search, tabs and other controls that must remain visible. */
  controls?: ReactNode;
  /** A table frame that owns the remaining viewport and its scroll. */
  children: ReactNode;
};

/**
 * Viewport-bound layout for operational listings. Page furniture never
 * scrolls; the table frame receives all remaining height and owns overflow.
 */
export const DataTablePage = forwardRef<HTMLDivElement, DataTablePageProps>(
  ({ children, className, controls, header, ...props }, ref) => (
    <div
      {...props}
      className={cn(
        "mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-5 overflow-hidden p-8",
        className,
      )}
      data-slot="data-table-page"
      ref={ref}
    >
      <div className="shrink-0" data-slot="data-table-page-header">
        {header}
      </div>
      {controls === undefined ? null : (
        <div className="shrink-0" data-slot="data-table-page-controls">
          {controls}
        </div>
      )}
      <div className="min-h-0 flex-1" data-slot="data-table-page-content">
        {children}
      </div>
    </div>
  ),
);

DataTablePage.displayName = "DataTablePage";
