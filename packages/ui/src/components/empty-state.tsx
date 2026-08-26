import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "../lib/utils";

export type EmptyStateProps = ComponentPropsWithoutRef<"div"> & {
  /** Decorative icon, e.g. a lucide element. Hidden from assistive tech. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call to action, e.g. a `Button`. */
  action?: ReactNode;
};

/**
 * Quiet centered message for empty lists and filters without results. Plain
 * paragraphs on purpose: it appears inside arbitrary regions (table bodies,
 * panels) and must not disturb the page's heading outline.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ action, className, description, icon, title, ...props }, ref) => (
    <div
      {...props}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
      data-slot="empty-state"
      ref={ref}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
          data-slot="empty-state-icon"
        >
          {icon}
        </span>
      ) : null}
      <p
        className="font-display text-h3 font-semibold text-foreground"
        data-slot="empty-state-title"
      >
        {title}
      </p>
      {description ? (
        <p
          className="max-w-sm text-caption text-muted-foreground"
          data-slot="empty-state-description"
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4" data-slot="empty-state-action">
          {action}
        </div>
      ) : null}
    </div>
  ),
);

EmptyState.displayName = "EmptyState";
