"use client";

import { useState, type FormEvent, type JSX as ReactJSX } from "react";
import { Check } from "lucide-react";
import { Badge } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { Choices, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { Placement, OrganizationBoard } from "./model";
import { responseLabels } from "./confirmation";
import styles from "./organization.module.css";

const MIN_CONTINUITY_REASON_LENGTH = 3;
type Continuity = "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
type Props = {
  row: Placement;
  board: OrganizationBoard;
  onClose: () => void;
};
type ContinuityModel = {
  value: Continuity;
  reason: string;
  attentionNote: string;
  setAttentionNote: (value: string) => void;
  error: string;
  pending: boolean;
  mutationError: string | undefined;
  changeValue: (next: string) => void;
  changeReason: (next: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ContinuityDialog(props: Props): ReactJSX.Element {
  const model = useContinuityModel(props);
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Registrar resposta do aluno"
      description={`${props.row.studentName} · ${props.board.semester.name}`}
      formId="student-continuity"
      firstField="continuity-choice"
      submitLabel="Salvar resposta"
      submitDisabled={
        model.value === props.row.continuity &&
        model.reason.trim() === (props.row.continuityReason ?? "") &&
        model.attentionNote.trim() === (props.row.attentionNote ?? "")
      }
      onClose={props.onClose}
      pending={model.pending}
      error={model.mutationError ?? model.error}
    >
      <form id="student-continuity" noValidate className={styles.form} onSubmit={model.submit}>
        <ContinuityFields {...props} model={model} />
      </form>
    </TaskDialog>
  );
}

function useContinuityModel({ row, board, onClose }: Props): ContinuityModel {
  const [value, setValue] = useState<Continuity>(row.continuity as Continuity);
  const [reason, setReason] = useState(row.continuityReason ?? "");
  const [attentionNote, setAttentionNote] = useState(row.attentionNote ?? "");
  const [error, setError] = useState("");
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.continuity.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (
      ["CHANGE", "LEAVING"].includes(value) &&
      reason.trim().length < MIN_CONTINUITY_REASON_LENGTH
    ) {
      setError("Registre o motivo para a equipe acompanhar.");
      return;
    }
    if (!mutation.isPending) {
      mutation.mutate({
        semesterId: board.semester.id,
        id: row.id,
        version: row.version,
        continuity: value,
        reason,
        attentionNote,
      });
    }
  };
  return {
    value,
    reason,
    attentionNote,
    setAttentionNote,
    error,
    pending: mutation.isPending,
    mutationError: mutation.error?.message,
    submit,
    changeValue: (next) => {
      setValue(next as Continuity);
      setError("");
    },
    changeReason: (next) => {
      setReason(next);
      setError("");
    },
  };
}

function ContinuityFields({
  row,
  board,
  model,
}: Props & { model: ContinuityModel }): ReactJSX.Element {
  return (
    <>
      <ContinuityContract row={row} board={board} />
      <Choices
        name="continuity-choice"
        label="O que o aluno informou sobre este semestre?"
        value={model.value}
        options={responseLabels}
        onChange={model.changeValue}
      />
      <p className={styles.small} aria-live="polite">
        {continuityDescription(model.value, Boolean(row.publishedAt))}
      </p>
      <NarrativeField
        name="formation-attention"
        label="Risco de saída · opcional"
        placeholder="Ex.: a família mencionou dificuldade com o horário."
        value={model.attentionNote}
        onChange={model.setAttentionNote}
      />
      <NarrativeField
        name="continuity-reason"
        label={
          model.value === "CHANGE" || model.value === "LEAVING"
            ? "Motivo e próximo contato"
            : "Observações · opcional"
        }
        placeholder="O que foi conversado e o que precisa de acompanhamento"
        value={model.reason}
        onChange={model.changeReason}
      />
    </>
  );
}

function continuityDescription(value: Continuity, allocated: boolean): string {
  switch (value) {
    case "STAY":
      return allocated
        ? "Registra que o aluno confirmou a permanência na turma."
        : "Registra que o aluno vai continuar. A alocação é aplicada na revisão de vínculos.";
    case "CHANGE":
      return "Ao salvar, o aluno entra na fila para escolher outra turma.";
    case "LEAVING":
      return "Sinaliza uma possível saída para acompanhamento. A matrícula e o contrato seguem ativos.";
    case "UNDECIDED":
      return "Registre o contato e volte aqui quando o aluno responder.";
  }
}

function ContinuityContract({
  row,
  board,
}: {
  row: Placement;
  board: OrganizationBoard;
}): ReactJSX.Element {
  return (
    <>
      {row.confirmation === "PRECONFIRMED" && (
        <div className={styles.summary}>
          <Badge variant="info">
            <Check size={14} /> Pré-confirmado em {board.semester.name}
          </Badge>
          <p>As notas, a presença e a cobertura contratual permitem a pré-confirmação.</p>
        </div>
      )}
      {row.attention.coverageThrough && (
        <p className={styles.small}>
          Cobertura contratual até {formatDateOnlyBR(row.attention.coverageThrough)}.
        </p>
      )}
    </>
  );
}
