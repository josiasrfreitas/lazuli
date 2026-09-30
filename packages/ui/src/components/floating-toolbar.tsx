"use client";

import { Children, forwardRef, type ComponentProps } from "react";

import { cn } from "../lib/utils";

/** Overlays a positioned container without taking space from its content. */
export const FloatingToolbar = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-30 flex justify-center">
      <div
        {...props}
        ref={ref}
        role="region"
        data-slot="floating-toolbar"
        className={cn(
          "pointer-events-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-popover px-4 py-2 shadow-lg",
          className,
        )}
      >
        {Children.toArray(children).map((child, index) => (
          <div
            key={index}
            className={cn("flex items-center", index > 0 && "border-l border-border pl-3")}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  ),
);

FloatingToolbar.displayName = "FloatingToolbar";
