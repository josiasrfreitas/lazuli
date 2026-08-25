"use client";

import type { ReactElement } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";

import { cn } from "../lib/utils";

export const checkboxVariants = cva(
  [
    "group/checkbox flex shrink-0 items-center justify-center border border-input bg-transparent p-0 text-primary-foreground",
    "outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
    "hover:border-interactive hover:bg-accent",
    "focus-visible:border-ring focus-visible:shadow-focus",
    "data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary",
    "data-checked:hover:border-primary-hover data-checked:hover:bg-primary-hover",
    "data-indeterminate:hover:border-primary-hover data-indeterminate:hover:bg-primary-hover",
    "aria-invalid:border-destructive aria-invalid:data-checked:border-destructive aria-invalid:data-checked:bg-destructive",
    "aria-invalid:data-indeterminate:border-destructive aria-invalid:data-indeterminate:bg-destructive",
    "aria-invalid:hover:border-destructive-hover aria-invalid:hover:bg-destructive-muted",
    "aria-invalid:data-checked:hover:border-destructive-hover aria-invalid:data-checked:hover:bg-destructive-hover",
    "aria-invalid:data-indeterminate:hover:border-destructive-hover aria-invalid:data-indeterminate:hover:bg-destructive-hover",
    "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
    "data-readonly:cursor-default",
  ],
  {
    variants: {
      size: {
        xs: "size-3 rounded-sm",
        sm: "size-3.5 rounded-sm",
        md: "size-4 rounded-sm",
        lg: "size-5 rounded-md",
        xl: "size-6 rounded-md",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type CheckboxSize = NonNullable<VariantProps<typeof checkboxVariants>["size"]>;

export type CheckboxProps = CheckboxPrimitive.Root.Props &
  VariantProps<typeof checkboxVariants> & {
    /** Marks the control invalid and exposes its state to assistive technologies. */
    invalid?: boolean;
  };

/**
 * An accessible binary form control with native form submission and support
 * for checked, indeterminate, invalid, disabled, and read-only states.
 */
export function Checkbox({
  className,
  invalid = false,
  size,
  ...props
}: CheckboxProps): ReactElement {
  return (
    <CheckboxPrimitive.Root
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(checkboxVariants({ size }), className)}
      data-invalid={invalid || undefined}
      data-slot="checkbox"
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center data-unchecked:hidden"
        data-slot="checkbox-indicator"
      >
        <Check aria-hidden="true" className="size-3 group-data-indeterminate/checkbox:hidden" />
        <Minus
          aria-hidden="true"
          className="hidden size-3 group-data-indeterminate/checkbox:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
