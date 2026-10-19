"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import type { z } from "@lazuli/validators";
import {
  Alert,
  Button,
  cn,
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
export function useValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  function validate<T>(schema: z.ZodType<T>, values: unknown): T | null {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    setErrors(
      Object.fromEntries(
        parsed.error.issues.flatMap((issue) => [
          [issue.path[0], issue.message],
          [issue.path.join("."), issue.message],
        ]),
      ),
    );
    setRevision((value) => value + 1);
    return null;
  }
  const clear = (name: string): void =>
    setErrors((value) =>
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== name && !key.startsWith(`${name}.`)),
      ),
    );
  function validateFields<T>(
    schema: z.ZodType<T>,
    input: { values: object; fields: string[] },
  ): boolean {
    const parsed = schema.safeParse(input.values);
    const issues = parsed.success
      ? []
      : parsed.error.issues.filter((issue) => input.fields.includes(String(issue.path[0])));
    const nextErrors: Record<string, string> = {};
    for (const issue of issues) {
      nextErrors[String(issue.path[0])] = issue.message;
      nextErrors[issue.path.join(".")] = issue.message;
    }
    setErrors(nextErrors);
    if (issues.length > 0) setRevision((value) => value + 1);
    return issues.length === 0;
  }
  return { errors, body, validate, validateFields, clear };
}
export function NarrativeField({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  rows = 3,
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
export function TaskDialog({
  title,
  description,
  onClose,
  pending,
  formId,
  firstField,
  submitLabel,
  submitVariant = "primary",
  children,
  error,
  bodyRef,
  size = "default",
  onBack,
  submitDisabled = false,
  actionSize = "md",
  submitIcon,
  cancelIcon,
  backIcon,
  contentClassName,
  compactHeader = false,
  bodyClassName,
}: {
  title: string;
  description: string;
  onClose: () => void;
  pending: boolean;
  formId: string;
  firstField: string;
  submitLabel: string;
  submitDisabled?: boolean;
  actionSize?: "sm" | "md";
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  backIcon?: ReactNode;
  contentClassName?: string;
  compactHeader?: boolean;
  bodyClassName?: string;
  submitVariant?: ButtonVariant;
  size?: "default" | "medium" | "wide" | "extra-wide";
  onBack?: (() => void) | undefined;
  children: ReactNode | ((actions: ReactNode) => ReactNode);
  error?: string | undefined;
  bodyRef?: React.RefObject<HTMLDivElement | null> | undefined;
}): ReactElement {
  const actions = (
    <>
      {onBack && (
        <Button type="button" size={actionSize} variant="ghost" disabled={pending} onClick={onBack}>
          {backIcon}
          Voltar
        </Button>
      )}
      <Button
        type="button"
        size={actionSize}
        variant="secondary"
        disabled={pending}
        onClick={onClose}
      >
        {cancelIcon}
        Cancelar
      </Button>
      <Button
        id={`${formId}-submit`}
        type="submit"
        form={formId}
        variant={submitVariant}
        size={actionSize}
        disabled={pending || submitDisabled}
      >
        {submitIcon}
        {pending ? "Salvando…" : submitLabel}
      </Button>
    </>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={cn(
            size === "extra-wide"
              ? "md:max-w-6xl"
              : size === "wide"
                ? "md:max-w-5xl"
                : size === "medium"
                  ? "md:max-w-3xl"
                  : undefined,
            contentClassName,
          )}
          initialFocus={() =>
            document.getElementById(firstField) ??
            document.querySelector<HTMLElement>(`[name="${CSS.escape(firstField)}"]`)
          }
        >
          <DialogHeader
            className={
              compactHeader ? "flex-row flex-wrap items-baseline gap-x-3 gap-y-1" : undefined
            }
          >
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={bodyRef} className={bodyClassName}>
            {typeof children === "function" ? children(actions) : children}
            {error && <Alert variant="destructive">{error}</Alert>}
          </DialogBody>
          {typeof children !== "function" && <DialogFooter>{actions}</DialogFooter>}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
