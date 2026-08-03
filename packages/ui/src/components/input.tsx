import type { ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "../lib/utils";

export type InputProps = ComponentProps<"input"> & {
  /** Marks the control invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
};

export function Input({ className, invalid = false, ...props }: InputProps): ReactElement {
  return (
    <InputPrimitive
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "flex h-control-md w-full min-w-0 rounded-md border border-input bg-transparent px-3",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-disabled",
          "read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground",
        ],
        className,
      )}
      data-invalid={invalid || undefined}
      data-slot="input"
    />
  );
}
