"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

export type DialogHeaderProps = ComponentPropsWithoutRef<"div">;

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      // pr-8 reserves space for the close X in DialogContent (dialog.tsx:
      // `absolute right-4` + `size-8`) — the pair must change together.
      className={cn("flex shrink-0 flex-col gap-2 pr-8 text-left", className)}
      data-slot="dialog-header"
      ref={ref}
    />
  ),
);

DialogHeader.displayName = "DialogHeader";

export type DialogBodyProps = ComponentPropsWithoutRef<"div">;

/**
 * The dialog's scrollable region. Header, footer, and the close button stay
 * pinned while only this area scrolls when content exceeds the viewport.
 */
export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      className={cn("scrollbar-subtle min-h-0 flex-1 overflow-y-auto", className)}
      data-slot="dialog-body"
      ref={ref}
    />
  ),
);

DialogBody.displayName = "DialogBody";

export type DialogFooterProps = ComponentPropsWithoutRef<"div">;

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      className={cn(
        "mt-6 flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="dialog-footer"
      ref={ref}
    />
  ),
);

DialogFooter.displayName = "DialogFooter";
