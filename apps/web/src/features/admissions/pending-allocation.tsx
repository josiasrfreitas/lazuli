"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import type { Candidate } from "./labels";

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
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {candidate.allocationPendingAt ? "Editar pendência" : "Deixar alocação pendente"}
        </Button>
      </div>
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
          <form
            id="lead-pending"
            noValidate
            className="grid gap-4 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length < 3) {
                setError("Informe o motivo da pendência.");
                return;
              }
              if (!mutation.isPending) mutation.mutate({ id: candidate.id, pending: true, reason });
            }}
          >
            <p className="text-caption text-muted-foreground">
              O lead ficará na fila da organização de turmas, junto de outras pessoas do mesmo
              estágio.
            </p>
            <NarrativeField
              name="pending-reason"
              label="O que impede a alocação?"
              placeholder="Sem horário compatível, prefere turma regular…"
              value={reason}
              onChange={(value) => {
                setReason(value);
                setError("");
              }}
            />
            {candidate.allocationPendingAt && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: candidate.id, pending: false })}
              >
                Retirar da fila
              </Button>
            )}
          </form>
        </TaskDialog>
      )}
    </>
  );
}
