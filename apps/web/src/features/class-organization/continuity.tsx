"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { Choices, dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import type { OrganizationAction, Placement, SemesterBoard, ClassPlan } from "./model";
import styles from "./organization.module.css";

const MIN_CONTINUITY_REASON_LENGTH = 3;

type Continuity = "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
export function ContinuityDialog({
  row,
  board,
  onClose,
  onAction,
}: {
  row: Placement;
  board: SemesterBoard;
  onClose: () => void;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
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
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Continuidade do aluno"
      description={row.studentName}
      formId="student-continuity"
      firstField="continuity-choice"
      submitLabel="Salvar continuidade"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message ?? error}
    >
      <form
        id="student-continuity"
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (
            ["CHANGE", "LEAVING"].includes(value) &&
            reason.trim().length < MIN_CONTINUITY_REASON_LENGTH
          ) {
            setError("Registre o motivo para a equipe acompanhar.");
            return;
          }
          if (!mutation.isPending)
            mutation.mutate({
              semesterId: board.semester.id,
              id: row.id,
              version: row.version,
              continuity: value,
              reason,
            });
        }}
      >
        <Choices
          name="continuity-choice"
          label="O que o aluno pretende?"
          value={value}
          options={{
            STAY: "Continuar na turma",
            CHANGE: "Mudar de turma",
            LEAVING: "Sair da escola",
            UNDECIDED: "A conversar",
          }}
          onChange={(next) => {
            setValue(next as Continuity);
            setError("");
          }}
        />
        <p className="text-caption text-muted-foreground">
          {value === "CHANGE"
            ? "O aluno entra nas pendências de alocação e mantém a matrícula atual até a transferência."
            : value === "LEAVING"
              ? "A intenção fica sinalizada para acompanhamento. A matrícula e o contrato continuam ativos."
              : "Registre o combinado para a equipe acompanhar a continuidade."}
        </p>
        {(row.nextPeriodCovered || row.periodCovered) && (
          <div className={styles.summary}>
            <strong>
              {row.nextPeriodCovered
                ? `Contrato cobre o próximo período (${board.nextSemester?.name})`
                : `Contrato cobre ${board.semester.name}`}
            </strong>
            <p>
              A continuidade está prevista pelo contrato. Mudanças de turma e intenção de saída
              precisam ser conversadas.
            </p>
          </div>
        )}
        {row.contract?.endsOn && (
          <p className={styles.small}>
            Contrato até {formatDateOnlyBR(dateOnly(row.contract.endsOn))}.
          </p>
        )}
        <NarrativeField
          name="continuity-reason"
          label={
            value === "CHANGE" || value === "LEAVING"
              ? "Motivo e próximo contato"
              : "Observações · opcional"
          }
          placeholder="O que foi conversado e o que precisa de acompanhamento"
          value={reason}
          onChange={(next) => {
            setReason(next);
            setError("");
          }}
        />
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
      </form>
    </TaskDialog>
  );
}

export function PlanStatusDialog({
  plan,
  open,
  onClose,
  onFeedback,
}: {
  plan: ClassPlan;
  open: boolean;
  onClose: () => void;
  onFeedback: (message: string) => void;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.planStatus.useMutation({
    onSuccess: async () => {
      await refresh();
      onFeedback(
        open
          ? "Turma aberta para receber alunos."
          : "Turma encerrada. Você pode reabri-la pelas opções da organização.",
      );
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={open ? (plan.classId ? "Reabrir turma" : "Abrir turma") : "Encerrar turma"}
      description={plan.name}
      formId="plan-status"
      firstField=""
      submitLabel={open ? "Abrir turma" : "Encerrar turma"}
      pending={mutation.isPending}
      error={mutation.error?.message}
      onClose={onClose}
    >
      <form
        className={styles.form}
        id="plan-status"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) mutation.mutate({ id: plan.id, version: plan.version, open });
        }}
      >
        <p className="text-caption">
          {open
            ? "A turma ficará disponível para matrículas. As aulas serão geradas pelo calendário do período."
            : "A turma sai dos horários disponíveis. Transfira ou encerre os vínculos dos alunos antes de continuar. O histórico será preservado."}
        </p>
      </form>
    </TaskDialog>
  );
}
