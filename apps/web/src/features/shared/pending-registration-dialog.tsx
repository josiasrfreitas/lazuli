"use client";
import type { JSX as ReactJSX } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, Trash2 } from "lucide-react";
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
  onReviewPending?: ((index: number) => void) | undefined;
  blockingItems?: { label: string; onResolve: () => void }[];
  pending: boolean;
  error?: string | undefined;
  onBack: () => void;
  onConfirm: () => void;
  onDiscard?: (() => void) | undefined;
};

export function PendingRegistrationDialog({
  entity,
  pendingItems,
  onReviewPending,
  blockingItems = [],
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
          <PendingRegistrationHeading
            entity={entity}
            blocked={blockingItems.length > 0}
            hasPendingItems={pendingItems.length > 0}
          />
          <PendingRegistrationBody
            pendingItems={pendingItems}
            onReviewPending={onReviewPending}
            blockingItems={blockingItems}
            error={error}
            pending={pending}
          />
          <PendingRegistrationActions
            pending={pending}
            onResolve={blockingItems[0]?.onResolve}
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

function PendingRegistrationHeading({
  entity,
  blocked,
  hasPendingItems,
}: {
  entity: PendingRegistrationProps["entity"];
  blocked: boolean;
  hasPendingItems: boolean;
}): ReactJSX.Element {
  let title = `Salvar ${entity} antes de fechar?`;
  let description = "As alterações ainda não foram salvas.";
  if (blocked) {
    title = "Antes de fechar";
    description = "Complete o essencial para salvar.";
  } else if (hasPendingItems) {
    title = `Salvar ${entity} com pendências?`;
    description = "Você pode resolver as pendências depois.";
  }
  return (
    <DialogHeader>
      <DialogTitle size={entity === "aluno" ? "lg" : "md"}>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
}

function PendingRegistrationBody({
  pendingItems,
  onReviewPending,
  blockingItems,
  error,
  pending,
}: {
  pendingItems: string[];
  onReviewPending?: ((index: number) => void) | undefined;
  blockingItems: { label: string; onResolve: () => void }[];
  error: string | undefined;
  pending: boolean;
}): ReactJSX.Element {
  return (
    <DialogBody>
      <BlockingRegistrationItems blockingItems={blockingItems} pending={pending} />
      <DeferredRegistrationItems
        pendingItems={pendingItems}
        pending={pending}
        onReviewPending={onReviewPending}
      />
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
  onResolve,
  hasPendingItems,
  onBack,
  onConfirm,
  onDiscard,
}: {
  pending: boolean;
  onResolve: (() => void) | undefined;
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
        <ArrowLeft /> Voltar
      </Button>
      {onResolve ? (
        <Button disabled={pending} onClick={onResolve}>
          Revisar dados <ArrowRight />
        </Button>
      ) : (
        <Button loading={pending} onClick={onConfirm}>
          <Check /> {hasPendingItems ? "Salvar com pendências" : "Salvar e fechar"}
        </Button>
      )}
    </DialogFooter>
  );
}

function BlockingRegistrationItems({
  blockingItems,
  pending,
}: {
  blockingItems: NonNullable<PendingRegistrationProps["blockingItems"]>;
  pending: boolean;
}): ReactJSX.Element | null {
  if (blockingItems.length === 0) return null;
  return (
    <section
      className="mt-5 rounded-lg border border-border p-4"
      aria-label="Informações obrigatórias pendentes"
    >
      <h3 className="flex items-center gap-2 font-semibold text-heading">
        <CircleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
        Informações obrigatórias pendentes
        <span className="ml-auto text-sm">{blockingItems.length}</span>
      </h3>
      <ul className="mt-2 divide-y divide-border">
        {blockingItems.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span>{item.label}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={`Preencher: ${item.label}`}
              onClick={item.onResolve}
            >
              <ArrowRight aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeferredRegistrationItems({
  pendingItems,
  pending,
  onReviewPending,
}: Pick<
  PendingRegistrationProps,
  "pendingItems" | "pending" | "onReviewPending"
>): ReactJSX.Element | null {
  if (pendingItems.length === 0) return null;
  return (
    <section
      className="mt-4 rounded-lg border border-border p-4"
      aria-label="Pode ficar para depois"
    >
      <h3 className="flex items-center gap-2 font-semibold text-muted-foreground">
        <Clock3 className="size-5" aria-hidden="true" />
        Pode ficar para depois
      </h3>
      <ul className="mt-2 divide-y divide-border">
        {pendingItems.map((item, index) => (
          <li key={item} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{item}</span>
            {onReviewPending && (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`Revisar: ${item}`}
                onClick={() => onReviewPending(index)}
              >
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
