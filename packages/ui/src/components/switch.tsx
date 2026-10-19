"use client";

import type { ReactElement } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { Check, Minus } from "lucide-react";

import { cn } from "../lib/utils";

export type SwitchProps = SwitchPrimitive.Root.Props;

/** Binary on/off control for an independent condition. */
export function Switch({ className, ...props }: SwitchProps): ReactElement {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn(
        "group/switch relative isolate inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted p-0.5 outline-none",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity before:duration-fast before:ease-standard data-checked:before:opacity-100",
        "enabled:not-data-readonly:hover:border-interactive focus-visible:border-ring focus-visible:shadow-focus focus-visible:before:transition-none",
        "data-checked:border-primary data-checked:hover:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-disabled data-readonly:cursor-default",
        className,
      )}
      data-slot="switch"
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none relative flex size-4.5 shrink-0 items-center justify-center transform-[translateX(0)] transition-transform duration-base ease-standard",
          "data-checked:transform-[translateX(calc(var(--spacing)*5))] rtl:data-checked:transform-[translateX(calc(var(--spacing)*-5))]",
          "group-focus-visible/switch:transition-none motion-reduce:transition-none",
        )}
        data-slot="switch-thumb"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative flex size-full items-center justify-center rounded-full bg-field text-muted-foreground shadow-sm transition-transform duration-fast ease-standard",
            "group-data-checked/switch:bg-primary-foreground group-data-checked/switch:text-primary",
            "dark:bg-muted-foreground dark:text-background dark:group-data-checked/switch:bg-accent-foreground dark:group-data-checked/switch:text-background",
            "group-active/switch:scale-95 group-data-disabled/switch:scale-100 group-data-readonly/switch:scale-100",
            "group-focus-visible/switch:scale-100 group-focus-visible/switch:transition-none motion-reduce:scale-100 motion-reduce:transition-none",
          )}
        >
          <Minus
            className="absolute size-3 transition-opacity duration-fast ease-standard group-data-checked/switch:opacity-0 group-focus-visible/switch:transition-none"
            strokeWidth={2.5}
          />
          <Check
            className="absolute size-3 opacity-0 transition-opacity duration-fast ease-standard group-data-checked/switch:opacity-100 group-focus-visible/switch:transition-none"
            strokeWidth={2.5}
          />
        </span>
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
