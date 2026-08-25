import type { ReactElement } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../lib/utils";

export type FieldProps = FieldPrimitive.Root.Props;

/**
 * Groups a `Label`, a control, and its messages into one form field.
 *
 * The control registers itself with the group — `Input`, `Textarea`, and
 * `Checkbox` from this package all do — so the label, the description, and the
 * error message resolve their own `id` and `aria-describedby` links.
 */
export function Field({ className, ...props }: FieldProps): ReactElement {
  return (
    <FieldPrimitive.Root
      className={cn("grid w-full gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

export type FieldDescriptionProps = FieldPrimitive.Description.Props;

/** Supporting text for the control, announced alongside its label. */
export function FieldDescription({ className, ...props }: FieldDescriptionProps): ReactElement {
  return (
    <FieldPrimitive.Description
      className={cn("text-caption text-muted-foreground", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

export type FieldErrorProps = FieldPrimitive.Error.Props;

/**
 * The validation message for the control. By default it follows the browser's
 * own validity state; pass `match` to drive visibility from the outside, which
 * is what a server-side rejection needs.
 */
export function FieldError({ className, ...props }: FieldErrorProps): ReactElement {
  return (
    <FieldPrimitive.Error
      className={cn("text-caption text-destructive", className)}
      data-slot="field-error"
      {...props}
    />
  );
}
