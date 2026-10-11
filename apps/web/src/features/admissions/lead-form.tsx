"use client";
import { useState, type ReactElement, type ReactNode, type FormEvent } from "react";
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
} from "@lazuli/ui";
import { useScrollToError } from "~/lib/scroll-to-error";

export function useLeadErrors(): {
  fields: Record<string, string>;
  body: ReturnType<typeof useScrollToError>;
  clear: (field: string) => void;
  report: (issues: Array<{ path: PropertyKey[]; message: string }>) => void;
} {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  return {
    fields,
    body,
    clear: (field) => setFields((current) => ({ ...current, [field]: "" })),
    report: (issues) => {
      setFields(Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])));
      setRevision((value) => value + 1);
    },
  };
}
export function LeadFormDialog({
  id,
  title,
  description,
  firstField,
  children,
  pending,
  error,
  submitLabel,
  onSubmit,
  onClose,
  body,
}: {
  id: string;
  title: string;
  description: string;
  firstField: string;
  children: ReactNode;
  pending: boolean;
  error?: string | undefined;
  submitLabel: string;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  body: ReturnType<typeof useScrollToError>;
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
          <DialogBody ref={body}>
            <form id={id} onSubmit={onSubmit} noValidate className="grid gap-4 pt-4">
              {children}
              {error && <Alert variant="destructive">{error}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form={id} disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
