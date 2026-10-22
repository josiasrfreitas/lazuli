"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import type { Candidate } from "./labels";

const MIN_PENDING_REASON_LENGTH = 3;

export function PendingAllocation({ candidate }: { candidate: Candidate }): ReactJSX.Element {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(candidate.allocationPendingReason ?? "");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const mutation = trpc.semesterOrganization.pendingLead.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admissions.invalidate(), utils.semesterOrganization.invalidate()]);
      setOpen(false);
    },
  });
  return (
    <>
      <PendingAllocationTrigger candidate={candidate} onOpen={() => setOpen(true)} />
      {open && (
        <TaskDialog
          compactHeader
          actionSize="sm"
          title="Alocação pendente"
          description={candidate.fullName}
          formId="lead-pending"
          firstField="pending-reason"
          submitLabel="Salvar pendência"
          pending={mutation.isPending}
          error={mutation.error?.message ?? error}
          onClose={() => setOpen(false)}
        >
          <PendingAllocationForm
            candidate={candidate}
            reason={reason}
            pending={mutation.isPending}
            onChange={(value) => {
              setReason(value);
              setError("");
            }}
            onSubmit={() => {
              if (reason.trim().length < MIN_PENDING_REASON_LENGTH) {
                setError("Informe o motivo da pendência.");
                return;
              }
              if (!mutation.isPending) mutation.mutate({ id: candidate.id, pending: true, reason });
            }}
            onRemove={() => mutation.mutate({ id: candidate.id, pending: false })}
          />
        </TaskDialog>
      )}
    </>
  );
}

function PendingAllocationTrigger({
  candidate,
  onOpen,
}: {
  candidate: Candidate;
  onOpen: () => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <div className="grid gap-1">
        <p className="text-caption">
          {candidate.allocationPendingAt
            ? "Alocação pendente"
            : "Nenhuma turma atende ao combinado?"}
        </p>
        {candidate.allocationPendingAt && (
          <Link className="text-caption text-interactive" href="/organizacao">
            Ver na organização de turmas
          </Link>
        )}
      </div>
      <Button size="sm" variant="secondary" onClick={onOpen}>
        {candidate.allocationPendingAt ? "Editar pendência" : "Deixar alocação pendente"}
      </Button>
    </div>
  );
}

function PendingAllocationForm({
  candidate,
  reason,
  pending,
  onChange,
  onSubmit,
  onRemove,
}: {
  candidate: Candidate;
  reason: string;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRemove: () => void;
}): ReactJSX.Element {
  return (
    <form
      id="lead-pending"
      noValidate
      className="grid gap-4 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-caption text-muted-foreground">
        O lead ficará na fila da organização de turmas, junto de outras pessoas do mesmo estágio.
      </p>
      <NarrativeField
        name="pending-reason"
        label="O que impede a alocação?"
        placeholder="Sem horário compatível, prefere turma regular…"
        value={reason}
        onChange={onChange}
      />
      {candidate.allocationPendingAt && (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRemove}>
          Retirar da fila
        </Button>
      )}
    </form>
  );
}
