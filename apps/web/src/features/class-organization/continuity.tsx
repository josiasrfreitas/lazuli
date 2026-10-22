"use client";
import type { JSX as ReactJSX } from "react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/semester-organization/shared";
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
        : "A turma sai dos horários disponíveis. Transfira ou encerre os vínculos dos alunos antes de continuar. O histórico será preservado."}
    </p>
  );
}
