"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import type { z } from "@lazuli/validators";
import {
  Alert,
  Button,
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
      Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])),
    );
    setRevision((value) => value + 1);
    return null;
  }
  const clear = (name: string): void => setErrors((value) => ({ ...value, [name]: "" }));
  return { errors, body, validate, clear };
}
export function NarrativeField({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        autoComplete="off"
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        invalid={Boolean(error)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
export function FollowUpDialog({
  title,
  description,
  onClose,
  pending,
  formId,
  firstField,
  submitLabel,
  children,
  error,
  bodyRef,
}: {
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
}): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={() => document.getElementById(firstField)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={bodyRef}>
            {children}
            {error && <Alert variant="destructive">{error}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
