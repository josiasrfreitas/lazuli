import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "../lib/utils";

export type InputSize = "dense" | "xs" | "sm" | "md" | "lg" | "compact-responsive";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  /** Marks the control invalid and exposes its state to assistive technologies. */
  invalid?: boolean;
  /** `xs` is compact on desktop (28px) and touch-sized on narrow screens (44px). */
  size?: InputSize;
  leadingIcon?: ReactNode;
};

const SIZE_CLASSES: Record<InputSize, string> = {
  xs: "h-11 rounded-sm px-2 text-base sm:h-control-xs sm:text-control",
  dense: "h-control-xs rounded-sm px-2 text-caption",
  "compact-responsive": "h-11 rounded-sm px-2.5 text-base sm:h-control-sm sm:text-control",
  sm: "h-control-sm rounded-sm px-2.5",
  md: "h-control-md rounded-md px-3",
  lg: "h-control-lg rounded-lg px-4",
};

export function Input({
  className,
  invalid = false,
  size = "md",
  leadingIcon,
  ...props
}: InputProps): ReactElement {
  const input = (
    <InputPrimitive
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        [
          "flex w-full min-w-0 border border-input bg-field",
          "text-control text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-focus",
          "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:shadow-focus-invalid disabled:cursor-not-allowed disabled:opacity-disabled",
          "read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground",
          SIZE_CLASSES[size],
          leadingIcon && "pl-8",
        ],
        className,
      )}
      data-invalid={invalid || undefined}
      data-size={size}
      data-slot="input"
    />
  );
  return leadingIcon ? (
    <span className="relative block w-full min-w-0">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground [&_svg]:size-4">
        {leadingIcon}
      </span>
      {input}
    </span>
  ) : (
    input
  );
}
