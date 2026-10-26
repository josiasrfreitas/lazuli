"use client";
import type { JSX as ReactJSX } from "react";
import { AlertTriangle, ArrowLeft, Check, Trash2 } from "lucide-react";
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

type PendingRegistrationProps = {
  entity: "lead" | "aluno";
  pendingItems: string[];
  pending: boolean;
  error?: string | undefined;
  onBack: () => void;
  onConfirm: () => void;
  onDiscard?: (() => void) | undefined;
};

export function PendingRegistrationDialog({
  entity,
  pendingItems,
  pending,
  error,
  onBack,
  onConfirm,
  onDiscard,
}: PendingRegistrationProps): ReactJSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onBack();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pendingItems.length > 0
                ? `Salvar ${entity} com pendências?`
                : `Salvar ${entity} antes de fechar?`}
            </DialogTitle>
            <DialogDescription>
              {pendingItems.length > 0
                ? "O cadastro será salvo, mas ainda será necessário resolver:"
                : "As alterações ainda não foram salvas."}
            </DialogDescription>
          </DialogHeader>
          <PendingRegistrationBody pendingItems={pendingItems} error={error} />
          <PendingRegistrationActions
            pending={pending}
            hasPendingItems={pendingItems.length > 0}
            onBack={onBack}
            onConfirm={onConfirm}
            onDiscard={onDiscard}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PendingRegistrationBody({
  pendingItems,
  error,
}: {
  pendingItems: string[];
  error: string | undefined;
}): ReactJSX.Element {
  return (
    <DialogBody>
      <ul className="grid gap-3 py-3">
        {pendingItems.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            {item}
          </li>
        ))}
      </ul>
      {pendingItems.length > 0 && (
        <p className="text-caption text-muted-foreground">
          Essas pendências continuarão indicadas no cadastro.
        </p>
      )}
      {error && (
        <p className="mt-3 text-caption text-destructive" role="alert">
          {error}
        </p>
      )}
    </DialogBody>
  );
}

function PendingRegistrationActions({
  pending,
  hasPendingItems,
  onBack,
  onConfirm,
  onDiscard,
}: {
  pending: boolean;
  hasPendingItems: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onDiscard: (() => void) | undefined;
}): ReactJSX.Element {
  return (
    <DialogFooter className="sm:flex-wrap">
      {onDiscard && (
        <Button variant="ghost" disabled={pending} onClick={onDiscard}>
          <Trash2 /> Descartar e fechar
        </Button>
      )}
      <Button variant="secondary" disabled={pending} onClick={onBack}>
        <ArrowLeft /> Voltar e revisar
      </Button>
      <Button loading={pending} onClick={onConfirm}>
        <Check /> {hasPendingItems ? "Salvar com pendências" : "Salvar e fechar"}
      </Button>
    </DialogFooter>
  );
}
