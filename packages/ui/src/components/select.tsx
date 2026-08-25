"use client";

import type { ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";

import { cn } from "../lib/utils";

export { SelectContent, SelectScrollDownButton, SelectScrollUpButton } from "./select-content";
export type {
  SelectContentProps,
  SelectScrollDownButtonProps,
  SelectScrollUpButtonProps,
} from "./select-content";
export { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "./select-options";
export type {
  SelectGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectSeparatorProps,
} from "./select-options";

/**
 * A listbox for choosing a known value. It preserves native form submission
 * through the `name` prop and supports controlled or uncontrolled values.
 */
export const Select = SelectPrimitive.Root;

export type SelectProps<
  Value,
  Multiple extends boolean | undefined = false,
> = SelectPrimitive.Root.Props<Value, Multiple>;

export type SelectSize = "sm" | "md" | "lg";

export type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  /** Marks the control invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  size?: SelectSize;
};

export function SelectTrigger({
  children,
  className,
  invalid = false,
  size = "md",
  ...props
}: SelectTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "flex w-full min-w-0 items-center justify-between gap-2 border border-input bg-transparent",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-disabled",
          "data-[readonly]:cursor-default data-[readonly]:bg-muted data-[readonly]:text-muted-foreground",
          "data-[placeholder]:text-muted-foreground [&_[data-slot=select-value]]:min-w-0",
          "[&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate",
          "[&_[data-slot=select-icon]]:shrink-0 [&_[data-slot=select-icon]]:text-muted-foreground",
          size === "sm" && "h-control-sm rounded-sm px-3",
          size === "md" && "h-control-md rounded-md px-3",
          size === "lg" && "h-control-lg rounded-lg px-4",
        ],
        className,
      )}
      data-invalid={invalid || undefined}
      data-size={size}
      data-slot="select-trigger"
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <ChevronDown aria-hidden="true" className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export type SelectValueProps = SelectPrimitive.Value.Props;

export function SelectValue({ className, ...props }: SelectValueProps): ReactElement {
  return (
    <SelectPrimitive.Value
      className={cn("flex text-left", className)}
      data-slot="select-value"
      {...props}
    />
  );
}
