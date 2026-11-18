"use client";
import type { JSX as ReactJSX } from "react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/class-organization/shared";
import type { ClassPlan } from "./model";
import styles from "./organization.module.css";
export { ContinuityDialog } from "./continuity-form";

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
          : "Turma desfeita. Os alunos voltaram às pendências de encaixe.",
      );
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={open ? (plan.classId ? "Reabrir turma" : "Abrir turma") : "Desfazer turma"}
      description={plan.name}
      formId="plan-status"
      firstField=""
      submitVariant={open ? "primary" : "destructive"}
      submitLabel={open ? "Abrir turma" : "Desfazer turma"}
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
        <PlanStatusMessage open={open} />
      </form>
    </TaskDialog>
  );
}

function PlanStatusMessage({ open }: { open: boolean }): ReactJSX.Element {
  return (
    <p className="text-caption">
      {open
        ? "A turma ficará disponível para matrículas. As aulas serão geradas pelo calendário do período."
        : "Os alunos voltarão às pendências deste período. Entradas futuras serão canceladas e vínculos já em andamento serão encerrados hoje."}
    </p>
  );
}
