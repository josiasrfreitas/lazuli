"use client";

import { useState, type ReactElement } from "react";
import { Field, Input, Label } from "@lazuli/ui";
import { RotateCcw } from "lucide-react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh, type OrganizationBoard } from "./shared";

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
  const preview = trpc.semesterOrganization.resetPreview.useQuery(
    { semesterId },
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
    },
  );
  const refresh = useOrganizationRefresh();
  const reset = trpc.semesterOrganization.reset.useMutation({
    onSuccess: async ({ released }) => {
      await refresh();
      onFeedback?.(
        released === 1
          ? "1 vínculo voltou para a fila."
          : `${released} vínculos voltaram para a fila.`,
      );
      onClose();
    },
    onError: () => {
      setConfirmation("");
      void preview.refetch();
    },
  });
  const scope = preview.data;
  const canReset =
    !!scope?.release &&
    confirmation.trim().toUpperCase() === "REINICIAR" &&
    !preview.isFetching &&
    !preview.error;
  return (
    <TaskDialog
      compactHeader
      size="compact"
      title="Reiniciar formação"
      description={board.semester.name}
      firstField={scope?.release ? "formation-reset-confirmation" : "formation-reset-summary"}
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
        <div id="formation-reset-summary" tabIndex={-1} aria-live="polite" className="grid gap-2">
          {!scope && !preview.error && <p>Conferindo os vínculos deste semestre…</p>}
          {scope && (
            <>
              <strong>
                {scope.release === 0
                  ? "Nenhum destino provisório para retirar."
                  : scope.release === 1
                    ? "1 vínculo voltará para a fila de escolha de turma."
                    : `${scope.release} vínculos voltarão para a fila de escolha de turma.`}
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
        {Boolean(scope?.release) && (
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
      </form>
    </TaskDialog>
  );
}
