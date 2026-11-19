"use client";
import { useState, type ReactElement } from "react";
import { Field, Input, Label } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import styles from "./organization.module.css";
import { trpc } from "~/lib/trpc";
import { dateOnly, useOrganizationRefresh, type ClassPlan, type OrganizationBoard } from "./shared";

type Props = {
  board: OrganizationBoard;
  onClose: () => void;
  onFeedback: (message: string) => void;
};
export function RiskLimitDialog({ board, onClose, onFeedback }: Props): ReactElement {
  const previous = board.semester.formationRiskLimit;
  const [limit, setLimit] = useState(String(previous));
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.riskLimit.useMutation({
    onSuccess: async () => {
      await refresh();
      onFeedback("Limite de alunos atualizado.");
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      size="compact"
      title="Alerta de turma em risco"
      description={board.semester.name}
      firstField="formation-limit"
      formId="formation-risk"
      submitLabel="Salvar limite"
      pending={mutation.isPending}
      error={mutation.error?.message}
      onClose={onClose}
    >
      <form
        id="formation-risk"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending)
            mutation.mutate({ semesterId: board.semester.id, previous, limit: Number(limit) });
        }}
      >
        <RiskLimitField value={limit} onChange={setLimit} />
        <p className={styles.small}>
          Turmas com menos alunos que esse limite aparecem em risco. A equipe decide se a turma
          continua.
        </p>
      </form>
    </TaskDialog>
  );
}
export function PostponeDialog({
  plan,
  board,
  onFeedback,
  onClose,
}: Props & { plan: ClassPlan }): ReactElement {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.postpone.useMutation({
    onSuccess: async () => {
      await refresh();
      onFeedback("Início adiado. As entradas afetadas voltaram para revisão.");
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      size="compact"
      title="Adiar início da turma"
      description={plan.name}
      firstField="formation-start"
      formId="formation-postpone"
      submitLabel="Adiar início"
      pending={mutation.isPending}
      error={mutation.error?.message}
      onClose={onClose}
    >
      <form
        id="formation-postpone"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = parseDateBR(value);
          if (
            !next ||
            next <= dateOnly(plan.startDate) ||
            next <= toDateOnlySaoPaulo(new Date()) ||
            next > dateOnly(board.semester.endDate)
          ) {
            setError("Informe uma data futura, depois do início atual e dentro do período.");
            return;
          }
          if (!mutation.isPending)
            mutation.mutate({ planId: plan.id, version: plan.version, startsOn: next });
        }}
      >
        <p className={styles.small}>
          Início previsto em {formatDateOnlyBR(dateOnly(plan.startDate))}. Entradas agendadas para
          antes da nova data precisarão de confirmação.
        </p>
        <PostponedStartField
          value={value}
          error={error}
          onChange={(next) => {
            setValue(next);
            setError("");
          }}
        />
      </form>
    </TaskDialog>
  );
}

export function RiskLimitField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor="formation-limit">
        Até quantos alunos confirmados na turma ou pré-confirmados?
      </Label>
      <Input
        id="formation-limit"
        name="formation-limit"
        className="max-w-24"
        type="number"
        required
        min={1}
        max={50}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
export function PostponedStartField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string;
}): ReactElement {
  return (
    <TextControl
      name="formation-start"
      label="Nova data de início"
      placeholder="dd/mm/aaaa"
      inputMode="numeric"
      value={value}
      error={error}
      onChange={(raw) => onChange(maskDateBR(raw))}
    />
  );
}
