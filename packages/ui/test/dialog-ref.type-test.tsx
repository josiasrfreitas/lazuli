import { createRef } from "react";

import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "../src/components/dialog.js";

const triggerRef = createRef<HTMLButtonElement>();
const contentRef = createRef<HTMLDivElement>();
const headerRef = createRef<HTMLDivElement>();
const bodyRef = createRef<HTMLDivElement>();
const footerRef = createRef<HTMLDivElement>();
const titleRef = createRef<HTMLHeadingElement>();
const closeRef = createRef<HTMLButtonElement>();

export const dialogWithRefs = (
  <Dialog defaultOpen modal>
    <DialogTrigger ref={triggerRef}>Abrir diálogo</DialogTrigger>
    <DialogPortal>
      <DialogBackdrop />
      <DialogContent closeLabel="Fechar diálogo" ref={contentRef} showCloseButton>
        <DialogHeader ref={headerRef}>
          <DialogTitle ref={titleRef}>Novo contrato</DialogTitle>
          <DialogDescription>Revise os dados antes de criar o contrato.</DialogDescription>
        </DialogHeader>
        <DialogBody ref={bodyRef}>Revise as parcelas geradas.</DialogBody>
        <DialogFooter ref={footerRef}>
          <DialogClose aria-label="Fechar diálogo" ref={closeRef}>
            Fechar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
);

export const controlledDialogContract = (
  <Dialog modal="trap-focus" onOpenChange={() => {}} open>
    <DialogTrigger>Editar contrato</DialogTrigger>
  </Dialog>
);

// @ts-expect-error Dialog modal state accepts a boolean or "trap-focus".
export const invalidDialogModal = <Dialog modal="non-modal" />;

// @ts-expect-error DialogContent initial focus requires a boolean, ref, or callback.
export const invalidDialogInitialFocus = <DialogContent initialFocus="primeiro-campo" />;

// @ts-expect-error DialogContent showCloseButton requires a boolean.
export const invalidDialogShowCloseButton = <DialogContent showCloseButton="yes" />;
