"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { z } from "@lazuli/validators";
import {
  Alert,
  cn,
  Button,
  type ButtonVariant,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  Label,
  Textarea,
} from "@lazuli/ui";
import { useScrollToError } from "~/lib/scroll-to-error";
type Validation = {
  errors: Record<string, string>;
  body: ReturnType<typeof useScrollToError>;
  validate: <T>(schema: z.ZodType<T>, values: object) => T | null;
  clear: (name: string) => void;
  validateFields: (
    schema: z.ZodType<object>,
    input: { values: object; fields: string[] },
  ) => boolean;
};
export function useValidation(): Validation {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  function validate<T>(schema: z.ZodType<T>, values: object): T | null {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      next[String(issue.path[0])] = issue.message;
      next[issue.path.join(".")] = issue.message;
    }
    setErrors(next);
    setRevision((value) => value + 1);
    return null;
  }
  const clear = (name: string): void =>
    setErrors((value) =>
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== name && !key.startsWith(`${name}.`)),
      ),
    );
  function validateFields(
    schema: z.ZodType<object>,
    input: { values: object; fields: string[] },
  ): boolean {
    const parsed = schema.safeParse(input.values);
    const issues = parsed.success
      ? []
      : parsed.error.issues.filter((issue) => input.fields.includes(String(issue.path[0])));
    const next: Record<string, string> = {};
    for (const issue of issues) {
      next[String(issue.path[0])] = issue.message;
      next[issue.path.join(".")] = issue.message;
    }
    setErrors(next);
    if (issues.length > 0) setRevision((value) => value + 1);
    return issues.length === 0;
  }
  return { errors, body, validate, validateFields, clear };
}
const DEFAULT_ROWS = 3;
export function NarrativeField({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  rows = DEFAULT_ROWS,
  labelIcon,
}: {
  rows?: number;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
  labelIcon?: ReactNode;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>
        {labelIcon ? (
          <span className="inline-flex items-center gap-1.5">
            {labelIcon}
            {label}
          </span>
        ) : (
          label
        )}
      </Label>
      <Textarea
        id={name}
        name={name}
        autoComplete="off"
        rows={rows}
        size={rows <= 2 ? "sm" : "md"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        invalid={Boolean(error)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
type TaskDialogProps = {
  title: string;
  description: string;
  onClose: () => void;
  pending: boolean;
  formId: string;
  firstField: string;
  submitLabel: string;
  children: ReactNode | ((actions: ReactNode) => ReactNode);
  size?: "default" | "medium" | "wide" | "extra-wide";
  onBack?: (() => void) | undefined;
  submitDisabled?: boolean;
  actionSize?: "sm" | "md";
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  backIcon?: ReactNode;
  contentClassName?: string | undefined;
  bodyClassName?: string | undefined;
  compactHeader?: boolean;
  error?: string | undefined;
  bodyRef?: React.RefObject<HTMLDivElement | null> | undefined;
  submitVariant?: ButtonVariant;
};
export function TaskDialog(props: TaskDialogProps): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <TaskContent {...props} />
      </DialogPortal>
    </Dialog>
  );
}
const dialogWidths = {
  default: undefined,
  medium: "md:max-w-3xl",
  wide: "md:max-w-5xl",
  "extra-wide": "md:max-w-6xl",
} as const;
function TaskContent(props: TaskDialogProps): ReactElement {
  const actions = <TaskActions {...props} />;
  return (
    <DialogContent
      className={cn(dialogWidths[props.size ?? "default"], props.contentClassName)}
      showCloseButton={!props.pending}
      initialFocus={() =>
        document.querySelector<HTMLElement>(
          `#${CSS.escape(props.firstField)}, [name="${CSS.escape(props.firstField)}"]`,
        )
      }
    >
      <DialogHeader
        className={
          props.compactHeader ? "flex-row flex-wrap items-baseline gap-x-3 gap-y-1" : undefined
        }
      >
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>{props.description}</DialogDescription>
      </DialogHeader>
      <DialogBody ref={props.bodyRef} className={props.bodyClassName}>
        {typeof props.children === "function" ? props.children(actions) : props.children}
        {props.error && <Alert variant="destructive">{props.error}</Alert>}
      </DialogBody>
      {typeof props.children !== "function" && <DialogFooter>{actions}</DialogFooter>}
    </DialogContent>
  );
}
function TaskActions(props: TaskDialogProps): ReactElement {
  const size = props.actionSize ?? "md";
  return (
    <>
      {props.onBack && (
        <Button
          type="button"
          size={size}
          variant="ghost"
          disabled={props.pending}
          onClick={props.onBack}
        >
          {props.backIcon ?? <ArrowLeft aria-hidden="true" />} Voltar
        </Button>
      )}
      <Button
        type="button"
        size={size}
        variant="secondary"
        disabled={props.pending}
        onClick={props.onClose}
      >
        {props.cancelIcon ?? <X aria-hidden="true" />} Cancelar
      </Button>
      <Button
        id={`${props.formId}-submit`}
        type="submit"
        form={props.formId}
        size={size}
        disabled={props.pending || props.submitDisabled}
        variant={props.submitVariant ?? "primary"}
      >
        {props.submitIcon ?? <Check aria-hidden="true" />}
        {props.pending ? "Salvando…" : props.submitLabel}
      </Button>
    </>
  );
}
