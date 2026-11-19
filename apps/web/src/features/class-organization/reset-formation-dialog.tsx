"use client";

import { useState, type ReactElement } from "react";
import { Field, Input, Label } from "@lazuli/ui";
import { RotateCcw } from "lucide-react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh, type OrganizationBoard } from "./shared";

const previewOptions = {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: false,
} as const;

function releaseLabel(students: number, leads: number): string {
  return [
    students > 0 && (students === 1 ? "1 vínculo de aluno" : `${students} vínculos de alunos`),
    leads > 0 && (leads === 1 ? "1 lead" : `${leads} leads`),
  ]
    .filter(Boolean)
    .join(" e ");
}

export function ResetFormationDialog({
  board,
  onClose,
  onFeedback,
}: {
  board: OrganizationBoard;
  onClose: () => void;
  onFeedback?: (message: string) => void;
}): ReactElement {
  const semesterId = board.semester.id;
  const [confirmation, setConfirmation] = useState("");
  const preview = trpc.semesterOrganization.resetPreview.useQuery({ semesterId }, previewOptions);
  const refresh = useOrganizationRefresh();
  const reset = trpc.semesterOrganization.reset.useMutation({
    onSuccess: async ({ released, leads }) => {
      await refresh();
      const verb = released + leads === 1 ? "voltou" : "voltaram";
      onFeedback?.(`Formação reiniciada. ${releaseLabel(released, leads)} ${verb} à fila.`);
      onClose();
    },
    onError: () => {
      setConfirmation("");
      void preview.refetch();
    },
  });
  const scope = preview.data;
  const hasProposals = Boolean(scope && (scope.release || scope.leads));
  const canReset =
    hasProposals &&
    confirmation.trim().toUpperCase() === "REINICIAR" &&
    !preview.isFetching &&
    !preview.error;
  return (
    <TaskDialog
      compactHeader
      size="compact"
      title="Reiniciar formação"
      description={board.semester.name}
      firstField={hasProposals ? "formation-reset-confirmation" : "formation-reset-summary"}
      formId="formation-reset"
      submitLabel="Reiniciar formação"
      submitIcon={<RotateCcw />}
      pendingLabel="Reiniciando…"
      submitVariant="destructive"
      pending={reset.isPending}
      submitDisabled={!canReset}
      error={reset.error?.message ?? preview.error?.message}
      onClose={onClose}
    >
      <form
        id="formation-reset"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (scope && canReset && !reset.isPending)
            reset.mutate({ semesterId, fingerprint: scope.fingerprint });
        }}
      >
        <ResetContents
          scope={scope}
          hasProposals={hasProposals}
          failed={Boolean(preview.error)}
          confirmation={confirmation}
          setConfirmation={setConfirmation}
        />
      </form>
    </TaskDialog>
  );
}

function ResetContents({
  scope,
  hasProposals,
  failed,
  confirmation,
  setConfirmation,
}: {
  scope: { release: number; leads: number; keep: number } | undefined;
  hasProposals: boolean;
  failed: boolean;
  confirmation: string;
  setConfirmation: (value: string) => void;
}): ReactElement {
  return (
    <>
      <div id="formation-reset-summary" tabIndex={-1} aria-live="polite" className="grid gap-2">
        {!scope && !failed && <p>Conferindo os vínculos deste semestre…</p>}
        {scope && (
          <>
            <strong>
              {hasProposals
                ? `${releaseLabel(scope.release, scope.leads)} ${scope.release + scope.leads === 1 ? "voltará" : "voltarão"} à fila para escolher turma.`
                : "Nenhum destino provisório para retirar."}
            </strong>
            <p>
              {scope.keep === 1
                ? "1 vínculo mantém a turma"
                : `${scope.keep} vínculos mantêm a turma`}{" "}
              por confirmação, pré-confirmação ou matrícula aplicada.
            </p>
          </>
        )}
        <p className="text-muted-foreground text-sm">
          A grade, as notas e o histórico de conversas continuam disponíveis.
        </p>
      </div>
      {hasProposals && (
        <Field>
          <Label htmlFor="formation-reset-confirmation">Digite REINICIAR para confirmar</Label>
          <Input
            id="formation-reset-confirmation"
            placeholder="REINICIAR"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
      )}
    </>
  );
}
