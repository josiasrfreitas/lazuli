import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "../lib/utils";

export type FormSectionProps = Omit<ComponentPropsWithoutRef<"fieldset">, "title"> & {
  /** Visible name of the group, rendered as the fieldset legend. */
  title: ReactNode;
  /** Supporting text under the title, e.g. when the group becomes required. */
  description?: ReactNode;
  /** Control rendered at the end of the header row, e.g. an expand toggle. */
  action?: ReactNode;
};

/**
 * Chunks related fields under a compact header. Renders a real `fieldset`
 * named by its title (via `aria-labelledby`, since a `legend` would have to be
 * the first child and could not share a row with the action), so assistive
 * technologies announce the group name with each control inside.
 */
export const FormSection = forwardRef<HTMLFieldSetElement, FormSectionProps>(
  ({ action, children, className, description, title, ...props }, ref) => {
    const titleId = useId();

    return (
      <fieldset
        aria-labelledby={titleId}
        {...props}
        className={cn("grid min-w-0 gap-3", className)}
        data-slot="form-section"
        ref={ref}
      >
        <div className="flex items-start justify-between gap-3" data-slot="form-section-header">
          <div className="grid gap-0.5">
            <p className="text-control font-semibold leading-5 text-foreground" id={titleId}>
              {title}
            </p>
            {description === undefined ? null : (
              <p className="text-caption text-muted-foreground">{description}</p>
            )}
          </div>
          {action === undefined ? null : <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </fieldset>
    );
  },
);

FormSection.displayName = "FormSection";

const TWO_COLUMNS = 2;
const THREE_COLUMNS = 3;

export type FormRowColumns = 1 | typeof TWO_COLUMNS | typeof THREE_COLUMNS;

export type FormRowProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * Equal columns for short, related fields (phone/email, city/state) from the
   * `sm` breakpoint up; narrower screens stack. Pass a `sm:grid-cols-[…]`
   * class instead for uneven tracks.
   */
  columns?: FormRowColumns;
};

/** One line of a dense form. Fields inside align to the same top edge. */
export const FormRow = forwardRef<HTMLDivElement, FormRowProps>(
  ({ className, columns = 1, ...props }, ref) => (
    <div
      {...props}
      className={cn(
        "grid min-w-0 items-start gap-3",
        columns === TWO_COLUMNS && "sm:grid-cols-2",
        columns === THREE_COLUMNS && "sm:grid-cols-3",
        className,
      )}
      data-slot="form-row"
      ref={ref}
    />
  ),
);

FormRow.displayName = "FormRow";
