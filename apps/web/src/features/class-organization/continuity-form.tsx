"use client";

import { useState, type FormEvent, type JSX as ReactJSX } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { Choices, dateOnly, useOrganizationRefresh } from "~/features/class-organization/shared";
import type { OrganizationAction, Placement, OrganizationBoard } from "./model";
import { confirmationExplanation } from "./confirmation";
import styles from "./organization.module.css";

const MIN_CONTINUITY_REASON_LENGTH = 3;
type Continuity = "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
type Props = {
  row: Placement;
  board: OrganizationBoard;
  onClose: () => void;
  onAction: (action: OrganizationAction) => void;
};
type ContinuityModel = {
  value: Continuity;
  reason: string;
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
      title="Continuidade do aluno"
      description={`${props.row.studentName} · ${props.board.semester.name}`}
      formId="student-continuity"
      firstField="continuity-choice"
      submitLabel="Salvar continuidade"
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
      });
    }
  };
  return {
    value,
    reason,
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
  onAction,
  model,
}: Props & { model: ContinuityModel }): ReactJSX.Element {
  return (
    <>
      <Choices
        name="continuity-choice"
        label="O que o aluno pretende?"
        value={model.value}
        options={{
          STAY: "Continuar na turma",
          CHANGE: "Mudar de turma",
          LEAVING: "Sair da escola",
          UNDECIDED: "A conversar",
        }}
        onChange={model.changeValue}
      />
      <p className="text-caption text-muted-foreground">{continuityDescription(model.value)}</p>
      <ContinuityContract row={row} board={board} />
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
      <ContinuityActions row={row} value={model.value} onAction={onAction} />
    </>
  );
}

function continuityDescription(value: Continuity): string {
  if (value === "CHANGE")
    return "O aluno entra nas pendências de alocação e mantém a matrícula atual até a transferência.";
  if (value === "LEAVING")
    return "A intenção fica sinalizada para acompanhamento. A matrícula e o contrato continuam ativos.";
  return confirmationExplanation;
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
          <strong>Pré-confirmado em {board.semester.name}</strong>
          <p>O contrato cobre pelo menos os três primeiros meses deste período.</p>
        </div>
      )}
      {row.contract?.endsOn && (
        <p className={styles.small}>
          Contrato até {formatDateOnlyBR(dateOnly(row.contract.endsOn))}.
        </p>
      )}
    </>
  );
}

function ContinuityActions({
  row,
  value,
  onAction,
}: {
  row: Placement;
  value: Continuity;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.actions}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() =>
          onAction(
            row.publishedAt
              ? { kind: "move", rows: [row] }
              : { kind: "placement", studentId: row.studentId, row },
          )
        }
      >
        Revisar alocação
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onAction({ kind: "history", row })}
      >
        Histórico
      </Button>
      {value === "LEAVING" && (
        <Link className="text-caption text-interactive" href={`/alunos/${row.studentId}`}>
          Abrir perfil para acompanhar
        </Link>
      )}
    </div>
  );
}
