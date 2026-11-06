"use client";

import { forwardRef } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "../lib/utils";

export type SegmentedControlSize = "sm" | "md";

export type SegmentedControlProps = Omit<
  ToggleGroupPrimitive.Props<string>,
  "value" | "defaultValue" | "onValueChange" | "multiple"
> & {
  /** The selected item, or `null` when nothing is selected. */
  value: string | null;
  /** Fires with the new selection; pressing the selected item again clears it. */
  onValueChange: (value: string | null) => void;
  /** Marks the group invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  size?: SegmentedControlSize;
  /** Wrap labelled choices in narrow forms. */
  wrap?: boolean;
};

/**
 * Inline single-choice control for a handful of options (≤ 5) where a
 * dropdown would cost extra clicks. One Tab stop; arrow keys move between
 * items. Name the group via `aria-label` or `aria-labelledby`.
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  (
    { className, invalid = false, onValueChange, size = "md", value, wrap = false, ...props },
    ref,
  ) => (
    <ToggleGroupPrimitive
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "group/segmented inline-flex w-fit max-w-full items-stretch gap-0.5 rounded-full border border-transparent bg-muted p-0.5",
          "transition-colors duration-fast ease-standard motion-reduce:transition-none",
          "aria-invalid:border-destructive",
          "data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
          controlSize(size, wrap),
          wrap && "flex-wrap rounded-2xl",
        ],
        className,
      )}
      data-invalid={invalid || undefined}
      data-size={size}
      data-slot="segmented-control"
      onValueChange={(groupValue) => {
        onValueChange(groupValue[0] ?? null);
      }}
      ref={ref}
      value={value === null ? [] : [value]}
    />
  ),
);

SegmentedControl.displayName = "SegmentedControl";

export type SegmentedControlItemProps = TogglePrimitive.Props & {
  value: string;
};

export const SegmentedControlItem = forwardRef<HTMLButtonElement, SegmentedControlItemProps>(
  ({ className, ...props }, ref) => (
    <TogglePrimitive
      {...props}
      className={cn(
        [
          "inline-flex min-w-0 flex-auto select-none items-center justify-center whitespace-nowrap rounded-full px-3",
          "text-caption font-medium text-muted-foreground outline-none",
          "transition-[background-color,color,box-shadow] duration-fast ease-standard motion-reduce:transition-none",
          "hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "data-pressed:bg-card data-pressed:text-card-foreground data-pressed:shadow-sm",
          "data-disabled:pointer-events-none",
          "group-data-[size=sm]/segmented:min-h-6 group-data-[size=md]/segmented:min-h-8",
          "group-data-[size=md]/segmented:px-4",
        ],
        className,
      )}
      data-slot="segmented-control-item"
      ref={ref}
    />
  ),
);

SegmentedControlItem.displayName = "SegmentedControlItem";

function controlSize(size: SegmentedControlSize, wrap: boolean): string {
  if (size === "sm") return wrap ? "min-h-control-sm" : "h-control-sm";
  return wrap ? "min-h-control-md" : "h-control-md";
}
