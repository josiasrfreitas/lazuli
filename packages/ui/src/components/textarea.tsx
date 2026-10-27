import type { ComponentProps, ReactElement } from "react";

import { cn } from "../lib/utils";

export type TextareaProps = ComponentProps<"textarea"> & {
  /** Marks the control invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  size?: "sm" | "md";
};

/**
 * A native multiline text control for free-form form content.
 *
 * It retains native textarea behavior, including keyboard interaction and
 * vertical resizing, while aligning its semantic states with other controls.
 */
export function Textarea({
  className,
  invalid = false,
  size = "md",
  ...props
}: TextareaProps): ReactElement {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "scrollbar-subtle flex w-full min-w-0 resize-y rounded-md border border-input bg-field px-3 py-2",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:shadow-focus-invalid disabled:cursor-not-allowed disabled:opacity-disabled",
          "read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground",
        ],
        size === "sm" ? "min-h-16" : "min-h-24",
        className,
      )}
      data-invalid={invalid || undefined}
      data-slot="textarea"
    />
  );
}
