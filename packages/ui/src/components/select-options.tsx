"use client";

import type { ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

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
