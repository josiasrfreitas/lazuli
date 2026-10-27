"use client";
import type { JSX as ReactJSX } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
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

export function DiscardRegistrationDialog({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}): ReactJSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>
              Os dados preenchidos ou alterados ainda não foram salvos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="py-3 text-sm">Se fechar agora, essas alterações serão perdidas.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive" onClick={onDiscard}>
              <Trash2 />
              Descartar e fechar
            </Button>
            <Button onClick={onKeep}>
              <ArrowLeft />
              Continuar preenchendo
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
