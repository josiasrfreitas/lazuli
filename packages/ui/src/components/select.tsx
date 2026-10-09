"use client";

import type { ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "../lib/utils";

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
          "flex w-full min-w-0 items-center justify-between gap-2 border border-input bg-field",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-disabled",
          "data-[readonly]:cursor-default data-[readonly]:bg-muted data-[readonly]:text-muted-foreground",
          "data-[placeholder]:text-muted-foreground [&_[data-slot=select-value]]:min-w-0",
          "[&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate",
          "[&_[data-slot=select-icon]]:shrink-0 [&_[data-slot=select-icon]]:text-icon",
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

export type SelectGroupProps = SelectPrimitive.Group.Props;

export function SelectGroup({ className, ...props }: SelectGroupProps): ReactElement {
  return <SelectPrimitive.Group className={cn("scroll-my-1", className)} {...props} />;
}

export type SelectLabelProps = SelectPrimitive.GroupLabel.Props;

export function SelectLabel({ className, ...props }: SelectLabelProps): ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      className={cn("px-2 py-1 text-micro font-semibold text-muted-foreground", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

export type SelectItemProps = SelectPrimitive.Item.Props;

export function SelectItem({ children, className, ...props }: SelectItemProps): ReactElement {
  return (
    <SelectPrimitive.Item
      className={cn(
        [
          "relative flex w-full cursor-default items-center gap-2 rounded-sm py-2 pr-8 pl-2",
          "text-control text-foreground outline-none select-none",
          "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-disabled",
        ],
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate" data-slot="select-item-text">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        className="absolute right-2 flex size-4 items-center justify-center"
        data-slot="select-item-indicator"
      >
        <Check aria-hidden="true" className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export type SelectSeparatorProps = SelectPrimitive.Separator.Props;

export function SelectSeparator({ className, ...props }: SelectSeparatorProps): ReactElement {
  return (
    <SelectPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

const SELECT_CONTENT_SIDE_OFFSET = 4;

export type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignItemWithTrigger" | "alignOffset" | "side" | "sideOffset"
  >;

/**
 * The Select popup. It opens below the trigger by default. Set
 * `alignItemWithTrigger` to align the selected item over the trigger instead;
 * Base UI ignores the other positioning props while that mode is active.
 */
export function SelectContent({
  align = "start",
  alignItemWithTrigger = false,
  alignOffset = 0,
  children,
  className,
  side = "bottom",
  sideOffset = SELECT_CONTENT_SIDE_OFFSET,
  ...props
}: SelectContentProps): ReactElement {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        className="z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          {...props}
          className={cn(
            [
              "scrollbar-subtle z-50 max-h-(--available-height) min-w-(--anchor-width) overflow-x-hidden overflow-y-auto",
              "rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
              "origin-(--transform-origin) duration-fast ease-standard",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            ],
            className,
          )}
          data-slot="select-content"
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List data-slot="select-list">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export type SelectScrollUpButtonProps = SelectPrimitive.ScrollUpArrow.Props;

export function SelectScrollUpButton({
  className,
  ...props
}: SelectScrollUpButtonProps): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      className={cn(
        "sticky top-0 z-10 flex w-full items-center justify-center bg-popover py-1 text-muted-foreground",
        className,
      )}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <ChevronUp aria-hidden="true" className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

export type SelectScrollDownButtonProps = SelectPrimitive.ScrollDownArrow.Props;

export function SelectScrollDownButton({
  className,
  ...props
}: SelectScrollDownButtonProps): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      className={cn(
        "sticky bottom-0 z-10 flex w-full items-center justify-center bg-popover py-1 text-muted-foreground",
        className,
      )}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <ChevronDown aria-hidden="true" className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}
