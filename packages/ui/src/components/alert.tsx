import type { ComponentProps, ReactElement } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

export const alertVariants = cva(
  [
    "group/alert relative grid w-full gap-0.5 rounded-md border p-4 text-left text-caption",
    "has-data-[slot=alert-action]:pr-18 has-data-[slot=alert-icon]:grid-cols-[auto_1fr]",
    "has-data-[slot=alert-icon]:gap-x-3",
  ],
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-info/20 bg-info-muted text-info",
        success: "border-success/20 bg-success-muted text-success",
        warning: "border-warning/20 bg-warning-muted text-warning",
        destructive: "border-destructive/20 bg-destructive-muted text-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

export type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export function Alert({ className, role = "alert", variant, ...props }: AlertProps): ReactElement {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role={role}
      {...props}
    />
  );
}

export type AlertIconProps = ComponentProps<"span">;

export function AlertIcon({ className, ...props }: AlertIconProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "row-span-2 translate-y-0.5 text-current [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      data-slot="alert-icon"
      {...props}
    />
  );
}

export type AlertContentProps = ComponentProps<"div">;

export function AlertContent({ className, ...props }: AlertContentProps): ReactElement {
  return (
    <div className={cn("col-start-2 min-w-0", className)} data-slot="alert-content" {...props} />
  );
}

export type AlertTitleProps = ComponentProps<"div">;

export function AlertTitle({ className, ...props }: AlertTitleProps): ReactElement {
  return (
    <div
      className={cn("font-display text-caption font-semibold leading-5", className)}
      data-slot="alert-title"
      {...props}
    />
  );
}

export type AlertDescriptionProps = ComponentProps<"p">;

export function AlertDescription({ className, ...props }: AlertDescriptionProps): ReactElement {
  return (
    <p
      className={cn(
        "mt-1 leading-5 text-foreground [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      data-slot="alert-description"
      {...props}
    />
  );
}

export type AlertActionProps = ComponentProps<"div">;

export function AlertAction({ className, ...props }: AlertActionProps): ReactElement {
  return (
    <div
      className={cn("absolute top-4 right-4 text-control font-semibold leading-5", className)}
      data-slot="alert-action"
      {...props}
    />
  );
}
