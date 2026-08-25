import type { ReactElement } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../lib/utils";

export type LabelProps = FieldPrimitive.Label.Props;

/**
 * The visible name of a form control.
 *
 * Inside a `Field` it associates itself with that field's control, so no `id`
 * wiring is needed. Standalone it behaves like a native `<label>` — pass
 * `htmlFor`.
 */
export function Label({ className, ...props }: LabelProps): ReactElement {
  return (
    <FieldPrimitive.Label
      className={cn(
        [
          "select-none text-control font-semibold leading-5 text-foreground",
          "data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
        ],
        className,
      )}
      data-slot="label"
      {...props}
    />
  );
}
