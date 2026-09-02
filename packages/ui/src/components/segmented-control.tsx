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
};

/**
 * Inline single-choice control for a handful of options (≤ 5) where a
 * dropdown would cost extra clicks. One Tab stop; arrow keys move between
 * items. Name the group via `aria-label` or `aria-labelledby`.
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ className, invalid = false, onValueChange, size = "md", value, ...props }, ref) => (
    <ToggleGroupPrimitive
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "group/segmented inline-flex w-fit max-w-full items-stretch gap-0.5 border border-input bg-transparent p-0.5",
          "transition-[border-color,box-shadow] duration-fast ease-standard",
          "focus-within:border-ring aria-invalid:border-destructive",
          "data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
          size === "sm" && "h-control-sm rounded-sm",
          size === "md" && "h-control-md rounded-md",
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
          "inline-flex min-w-0 select-none items-center justify-center whitespace-nowrap px-2.5",
          "text-caption font-medium text-muted-foreground outline-none",
          "transition-colors duration-fast ease-standard",
          "hover:text-foreground focus-visible:shadow-focus",
          "data-pressed:bg-accent data-pressed:text-accent-foreground",
          "data-disabled:pointer-events-none",
          "group-data-[size=sm]/segmented:rounded-[calc(var(--radius-sm)-2px)]",
          "group-data-[size=md]/segmented:rounded-[calc(var(--radius-md)-2px)]",
        ],
        className,
      )}
      data-slot="segmented-control-item"
      ref={ref}
    />
  ),
);

SegmentedControlItem.displayName = "SegmentedControlItem";
