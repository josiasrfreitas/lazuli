import type { ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "../lib/utils";

export type InputSize = "xs" | "sm" | "md" | "lg";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  /** Marks the control invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  /** `xs` is compact on desktop (28px) and touch-sized on narrow screens (44px). */
  size?: InputSize;
};

export function Input({
  className,
  invalid = false,
  size = "md",
  ...props
}: InputProps): ReactElement {
  return (
    <InputPrimitive
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "flex w-full min-w-0 border border-input bg-transparent",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-disabled",
          "read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground",
          size === "xs" && "h-11 rounded-sm px-2 text-base sm:h-control-xs sm:text-control",
          size === "sm" && "h-control-sm rounded-sm px-2.5",
          size === "md" && "h-control-md rounded-md px-3",
          size === "lg" && "h-control-lg rounded-lg px-4",
        ],
        className,
      )}
      data-invalid={invalid || undefined}
      data-size={size}
      data-slot="input"
    />
  );
}
