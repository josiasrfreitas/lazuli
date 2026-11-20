"use client";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { PlanDateField } from "./form-fields";
import { dateLabel } from "./shared";
import type { AdjustmentFormProps } from "./extra-classes-form";
import { MINUTES_PER_HOUR } from "./extra-capacity";
import styles from "./adjustments.module.css";

const reviewDialog = {
  title: "Confirmar encerramento antecipado",
  firstField: "confirmation",
  pendingLabel: "Aplicando…",
  submitLabel: "Confirmar e cancelar aulas",
  submitVariant: "destructive",
} as const;
const entryDialog = {
  title: "Encerrar aulas antes do previsto",
  firstField: "lastDate",
  pendingLabel: "Conferindo…",
  submitLabel: "Conferir impactos",
  submitVariant: "primary",
} as const;

export function EndClassesForm({
  data,
  onClose,
  onBack,
  onSaved,
}: AdjustmentFormProps): ReactElement {
  const form = useEndClassesForm(data, onSaved);
  const { reviewing, pending, matches, preview, errorMessage } = form;
  return (
    <TaskDialog
      {...(reviewing ? reviewDialog : entryDialog)}
      description={data.scope.class.name}
      size="medium"
      formId="end-classes"
      pending={pending}
      onClose={onClose}
      onBack={reviewing ? form.resetReview : onBack}
      submitDisabled={reviewing && (!matches || Boolean(preview?.blocked))}
    >
      <form
        id="end-classes"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        {errorMessage && (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        )}
        {preview ? <EndReview preview={preview} form={form} /> : <EndFields form={form} />}
      </form>
    </TaskDialog>
  );
}

const MIN_REASON_LENGTH = 3;
type EndPreview = RouterOutputs["planning"]["previewEnd"];
type EndForm = {
  lastDate: string;
  setLastDate: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  confirmation: string;
  setConfirmation: (value: string) => void;
  reviewing: boolean;
  pending: boolean;
  matches: boolean;
  errorMessage: string | undefined;
  preview: EndPreview | undefined;
  resetReview: () => void;
  submit: () => void;
};

function useEndClassesForm(
  data: AdjustmentFormProps["data"],
  onSaved: AdjustmentFormProps["onSaved"],
): EndForm {
  const lastProjected = data.projection
    .flatMap((row) => (row.date ? [row.date] : []))
    .toSorted()
    .at(-1);
  const [lastDate, setLastDate] = useState(dateLabel(lastProjected ?? data.scope.today));
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | undefined>();
  const preview = trpc.planning.previewEnd.useMutation();
  const save = trpc.planning.endClasses.useMutation({
    onSuccess: (result) => onSaved(`${result.cancelled} aulas canceladas. Registros preservados.`),
  });

  const matches = confirmation.trim().toLocaleUpperCase("pt-BR") === preview.data?.confirmation;
  const pending = preview.isPending || save.isPending;
  const errorMessage = error ?? save.error?.message ?? preview.error?.message;
  function resetReview(): void {
    preview.reset();
    save.reset();
    setConfirmation("");
  }
  function submit(): void {
    if (pending) return;
    const date = parseDateBR(lastDate);
    if (!date || reason.trim().length < MIN_REASON_LENGTH) {
      setError("Informe a última data e o motivo do encerramento.");
      return;
    }
    setError(undefined);
    const input = { classId: data.scope.class.id, lastDate: date, reason };
    if (preview.data === undefined) preview.mutate(input);
    else if (matches && !preview.data.blocked)
      save.mutate({ ...input, fingerprint: preview.data.fingerprint, confirmation });
  }
  return {
    lastDate,
    setLastDate,
    reason,
    setReason,
    confirmation,
    setConfirmation,
    reviewing: Boolean(preview.data),
    pending,
    matches,
    errorMessage,
    preview: preview.data,
    resetReview,
    submit,
  };
}

function EndFields({ form }: { form: EndForm }): ReactElement {
  const { lastDate, setLastDate, reason, setReason } = form;
  return (
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
  );
}

function EndReview({ preview, form }: { preview: EndPreview; form: EndForm }): ReactElement {
  const { lastDate, confirmation, setConfirmation } = form;
  return (
    <>
      <div className={styles.preview} data-destructive>
        <h3>{preview.count} aulas serão canceladas</h3>
        <p>Último dia de aula: {lastDate}.</p>
        {preview.from && preview.through && (
          <p>
            Cancelamentos entre {dateLabel(preview.from)} e {dateLabel(preview.through)}.
          </p>
        )}
        <p>
          {preview.remainingMinutes / MINUTES_PER_HOUR}h de conteúdo restante ·{" "}
          {preview.availableMinutes / MINUTES_PER_HOUR}h mantidas até a última aula.
        </p>
      </div>
      <p className={styles.help}>
        Registros realizados são preservados. Isso não encerra matrículas nem contratos.
      </p>
      {preview.preserved > 0 && (
        <p className={styles.help}>
          {preview.preserved} aulas posteriores serão preservadas por terem registros, presença
          aberta ou convidados vinculados.
        </p>
      )}
      {preview.blocked ? (
        <p role="alert" className={styles.warning}>
          {preview.blocked} Volte e ajuste a data.
        </p>
      ) : (
        <>
          <p className={styles.help}>
            Para confirmar, digite <strong>{preview.confirmation}</strong>
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
  );
}
