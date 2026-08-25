import type { ReactElement } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "../lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap",
    "text-control font-semibold transition-colors duration-fast ease-standard",
    "focus-visible:outline-none focus-visible:shadow-focus",
    "disabled:pointer-events-none disabled:opacity-disabled",
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-border-strong bg-transparent text-foreground hover:bg-accent-hover hover:text-accent-foreground active:bg-accent-active",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent-active",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive-hover active:bg-destructive-active",
        link: "bg-transparent text-interactive underline-offset-4 hover:text-interactive-hover hover:underline active:text-interactive-active",
      },
      size: {
        sm: "h-control-sm gap-1.5 rounded-sm px-3",
        md: "h-control-md gap-2 rounded-md px-4",
        lg: "h-control-lg gap-2 rounded-lg px-5",
        "icon-sm": "size-control-sm rounded-sm",
        "icon-md": "size-control-md rounded-md",
        "icon-lg": "size-control-lg rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Prevents duplicate actions while preserving the button's dimensions and accessible name. */
    loading?: boolean;
  };

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps): ReactElement {
  return (
    <ButtonPrimitive
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ size, variant }), className)}
      data-loading={loading || undefined}
      data-slot="button"
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="absolute size-4 animate-spin" />
      ) : null}
      <span
        className={cn(
          "inline-flex items-center justify-center gap-[inherit]",
          loading && "opacity-0",
        )}
      >
        {children}
      </span>
    </ButtonPrimitive>
  );
}
