import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export type InlineSkeletonProps = ComponentPropsWithoutRef<"span">;

/** Placeholder for one fetched value inside otherwise-static copy or controls. */
export const InlineSkeleton = forwardRef<HTMLSpanElement, InlineSkeletonProps>(
  ({ className, ...props }, ref) => (
    <span
      {...props}
      aria-hidden="true"
      className={cn(
        "inline-block h-3 w-6 shrink-0 animate-pulse rounded-full bg-muted-foreground/20 align-middle motion-reduce:animate-none",
        className,
      )}
      data-slot="inline-skeleton"
      ref={ref}
    />
  ),
);

InlineSkeleton.displayName = "InlineSkeleton";
