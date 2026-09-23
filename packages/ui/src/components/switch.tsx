"use client";

import type { ReactElement } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "../lib/utils";

export type SwitchProps = SwitchPrimitive.Root.Props;

/** Binary on/off control for an independent condition. */
export function Switch({ className, ...props }: SwitchProps): ReactElement {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn(
        "group/switch inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted p-0.5 outline-none transition-colors duration-fast ease-standard",
        "hover:border-interactive focus-visible:border-ring focus-visible:shadow-focus",
        "data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
        className,
      )}
      data-slot="switch"
    >
      <SwitchPrimitive.Thumb
        className="size-4 rounded-full bg-background shadow-sm transition-transform duration-fast ease-standard group-data-checked/switch:translate-x-4"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
