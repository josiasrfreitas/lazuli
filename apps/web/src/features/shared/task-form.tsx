"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { z } from "@lazuli/validators";
import {
  Alert,
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
  return { errors, body, validate, clear };
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
  children: ReactNode;
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
        <DialogContent
          showCloseButton={!props.pending}
          initialFocus={() =>
            document.querySelector<HTMLElement>(
              `#${CSS.escape(props.firstField)}, [name="${CSS.escape(props.firstField)}"]`,
            )
          }
        >
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={props.bodyRef}>
            {props.children}
            {props.error && <Alert variant="destructive">{props.error}</Alert>}
          </DialogBody>
          <TaskActions {...props} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function TaskActions(props: TaskDialogProps): ReactElement {
  return (
    <DialogFooter>
      <Button type="button" variant="secondary" disabled={props.pending} onClick={props.onClose}>
        <X aria-hidden />
        Cancelar
      </Button>
      <Button
        type="submit"
        form={props.formId}
        disabled={props.pending}
        variant={props.submitVariant ?? "primary"}
      >
        <Check aria-hidden />
        {props.pending ? "Salvando…" : props.submitLabel}
      </Button>
    </DialogFooter>
  );
}
