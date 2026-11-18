"use client";
import { useState, type ReactElement } from "react";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { PlanDateField } from "./form-fields";
import { dateLabel } from "./shared";
import type { AdjustmentFormProps } from "./extra-classes-form";
import styles from "./adjustments.module.css";

export function EndClassesForm({
  data,
  onClose,
  onBack,
  onSaved,
}: AdjustmentFormProps): ReactElement {
  const lastProjected = data.projection
    .flatMap((row) => (row.date ? [row.date] : []))
    .sort()
    .at(-1);
  const [lastDate, setLastDate] = useState(dateLabel(lastProjected ?? data.scope.today));
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | undefined>();
  const preview = trpc.planning.previewEnd.useMutation();
  const save = trpc.planning.endClasses.useMutation({
    onSuccess: (result) => onSaved(`${result.cancelled} aulas canceladas. Registros preservados.`),
  });
  const reviewing = Boolean(preview.data);
  const matches = confirmation.trim().toLocaleUpperCase("pt-BR") === preview.data?.confirmation;
  const pending = preview.isPending || save.isPending;
  const errorMessage = error ?? save.error?.message ?? preview.error?.message;
  return (
    <TaskDialog
      title={reviewing ? "Confirmar encerramento antecipado" : "Encerrar aulas antes do previsto"}
      description={data.scope.class.name}
      size="medium"
      formId="end-classes"
      firstField={reviewing ? "confirmation" : "lastDate"}
      pending={pending}
      pendingLabel={reviewing ? "Aplicando…" : "Conferindo…"}
      onClose={onClose}
      onBack={
        reviewing
          ? () => {
              preview.reset();
              save.reset();
              setConfirmation("");
            }
          : onBack
      }
      submitLabel={reviewing ? "Confirmar e cancelar aulas" : "Conferir impactos"}
      submitVariant={reviewing ? "destructive" : "primary"}
      submitDisabled={reviewing && (!matches || Boolean(preview.data?.blocked))}
    >
      <form
        id="end-classes"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const date = parseDateBR(lastDate);
          if (!date || reason.trim().length < 3) {
            setError("Informe a última data e o motivo do encerramento.");
            return;
          }
          setError(undefined);
          const input = { classId: data.scope.class.id, lastDate: date, reason };
          if (!reviewing) preview.mutate(input);
          else if (matches && !preview.data!.blocked)
            save.mutate({ ...input, fingerprint: preview.data!.fingerprint, confirmation });
        }}
      >
        {errorMessage && (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        )}
        {!reviewing ? (
          <>
            <p className={styles.help}>
              Mantenha tempo para o conteúdo restante. As aulas posteriores à data escolhida serão
              analisadas antes de cancelar.
            </p>
            <PlanDateField
              name="lastDate"
              label="Último dia de aula"
              value={lastDate}
              onChange={setLastDate}
            />
            <NarrativeField
              name="reason"
              label="Motivo do encerramento"
              rows={2}
              value={reason}
              onChange={setReason}
              placeholder="Ex.: conteúdo concluído antes do fim do semestre"
            />
          </>
        ) : (
          preview.data && (
            <>
              <div className={styles.preview} data-destructive>
                <h3>{preview.data.count} aulas serão canceladas</h3>
                <p>Último dia de aula: {lastDate}.</p>
                {preview.data.from && preview.data.through && (
                  <p>
                    Cancelamentos entre {dateLabel(preview.data.from)} e{" "}
                    {dateLabel(preview.data.through)}.
                  </p>
                )}
                <p>
                  {preview.data.remainingMinutes / 60}h de conteúdo restante ·{" "}
                  {preview.data.availableMinutes / 60}h mantidas até a última aula.
                </p>
              </div>
              <p className={styles.help}>
                Registros realizados são preservados. Isso não encerra matrículas nem contratos.
              </p>
              {preview.data.preserved > 0 && (
                <p className={styles.help}>
                  {preview.data.preserved} aulas posteriores serão preservadas por terem registros,
                  presença aberta ou convidados vinculados.
                </p>
              )}
              {preview.data.blocked ? (
                <p role="alert" className={styles.warning}>
                  {preview.data.blocked} Volte e ajuste a data.
                </p>
              ) : (
                <>
                  <p className={styles.help}>
                    Para confirmar, digite <strong>{preview.data.confirmation}</strong>
                  </p>
                  <TextControl
                    name="confirmation"
                    label="Confirmação por escrito"
                    value={confirmation}
                    onChange={setConfirmation}
                  />
                </>
              )}
            </>
          )
        )}
      </form>
    </TaskDialog>
  );
}
