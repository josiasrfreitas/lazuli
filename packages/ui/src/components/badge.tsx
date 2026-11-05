import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

export const badgeVariants = cva(
  ["inline-flex shrink-0 items-center rounded-sm border leading-none"],
  {
    variants: {
      size: {
        sm: "h-[1.3125rem] w-fit justify-center px-2 text-micro font-semibold",
        field: "h-control-sm w-full min-w-0 justify-start px-2.5 text-control font-normal",
      },
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-success/20 bg-success-muted text-success",
        warning: "border-warning/20 bg-warning-muted text-warning",
        destructive: "border-destructive/20 bg-destructive-muted text-destructive",
        info: "border-info/20 bg-info-muted text-info",
        "over-capacity": "border-over-capacity/20 bg-over-capacity-muted text-over-capacity",
      },
    },
    defaultVariants: {
      size: "sm",
      variant: "neutral",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export type BadgeProps = useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, render, variant, size, ...props }: BadgeProps): ReactElement {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props,
    ),
    render,
    state: { slot: "badge", variant, size },
  });
}
