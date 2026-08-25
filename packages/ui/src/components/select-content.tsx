"use client";

import type { ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "../lib/utils";

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
