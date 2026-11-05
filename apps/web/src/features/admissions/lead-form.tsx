"use client";
import { useState, type ReactElement, type ReactNode, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import {
  ToastAlert,
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
      setFields(Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message])));
      setRevision((value) => value + 1);
    },
  };
}
type LeadFormDialogProps = {
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
  wide?: boolean;
  steps?: ReactNode;
  cancelLabel?: string;
  cancelIcon?: ReactNode;
  submitIcon?: ReactNode;
  backAtTop?: boolean;
};

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
  wide = false,
  steps,
  cancelLabel = "Cancelar",
  cancelIcon = <X aria-hidden="true" />,
  submitIcon = <Check aria-hidden="true" />,
  backAtTop = false,
}: LeadFormDialogProps): ReactElement {
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
          className={wide ? "md:max-w-3xl" : undefined}
          initialFocus={() => document.querySelector<HTMLElement>(`#${CSS.escape(firstField)}`)}
          showCloseButton={!backAtTop}
        >
          <div className="flex items-start justify-between gap-3">
            <DialogHeader className={backAtTop ? "pr-0" : undefined}>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {backAtTop && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>
                {cancelIcon}
                {cancelLabel}
              </Button>
            )}
          </div>
          {steps}
          <DialogBody ref={body}>
            <form id={id} onSubmit={onSubmit} noValidate className="grid gap-4 pt-4">
              {children}
              {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
            </form>
          </DialogBody>
          <LeadFormFooter
            {...{
              id,
              pending,
              onClose,
              cancelIcon,
              cancelLabel,
              submitIcon,
              submitLabel,
              backAtTop,
            }}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function LeadFormFooter({
  id,
  pending,
  onClose,
  cancelIcon,
  cancelLabel,
  submitIcon,
  submitLabel,
  backAtTop,
}: Required<
  Pick<
    LeadFormDialogProps,
    | "id"
    | "pending"
    | "onClose"
    | "cancelIcon"
    | "cancelLabel"
    | "submitIcon"
    | "submitLabel"
    | "backAtTop"
  >
>): ReactElement {
  return (
    <DialogFooter>
      {!backAtTop && (
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          {cancelIcon}
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" form={id} loading={pending}>
        {submitIcon}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
