"use client";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { Button, Dialog, DialogBackdrop, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogTitle } from "@lazuli/ui";

export function PendingRegistrationDialog({ entity, pendingItems, pending, error, onBack, onConfirm }: {
  entity: "lead" | "aluno";
  pendingItems: string[];
  pending: boolean;
  error?: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open && !pending) onBack(); }}><DialogPortal><DialogBackdrop />
    <DialogContent className="md:max-w-lg">
      <DialogHeader><DialogTitle>Salvar {entity} com pendências?</DialogTitle>
        <DialogDescription>O cadastro será salvo, mas ainda será necessário resolver:</DialogDescription>
      </DialogHeader>
      <DialogBody><ul className="grid gap-3 py-3">{pendingItems.map(item => <li key={item} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{item}</li>)}</ul>
        <p className="text-caption text-muted-foreground">Essas pendências continuarão indicadas no cadastro.</p>
        {error && <p className="mt-3 text-caption text-destructive" role="alert">{error}</p>}
      </DialogBody>
      <DialogFooter><Button variant="secondary" disabled={pending} onClick={onBack}><ArrowLeft />Voltar e revisar</Button>
        <Button loading={pending} onClick={onConfirm}><Check />Salvar com pendências</Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal></Dialog>;
}
