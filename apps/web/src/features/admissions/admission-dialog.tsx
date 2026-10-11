"use client";
import type { ComponentProps, FormEvent, ReactElement, ReactNode, RefObject } from "react";
import {
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

type AdmissionDialogProps = {
  title: string;
  description: ReactNode;
  formId: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  pending: boolean;
  submitLabel: string;
  backLabel?: string;
  onBack?: () => void;
  popup?: RefObject<HTMLDivElement | null>;
  body?: RefObject<HTMLDivElement | null>;
  initialFocus?: ComponentProps<typeof DialogContent>["initialFocus"];
};
export function AdmissionDialog(props: AdmissionDialogProps): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent ref={props.popup} initialFocus={props.initialFocus}>
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={props.body}>
            <form
              id={props.formId}
              noValidate
              onSubmit={props.onSubmit}
              className="grid gap-4 pt-4"
            >
              {props.children}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={props.pending}
              onClick={props.onBack ?? props.onClose}
            >
              {props.backLabel ?? "Voltar"}
            </Button>
            <Button type="submit" form={props.formId} disabled={props.pending}>
              {props.submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
