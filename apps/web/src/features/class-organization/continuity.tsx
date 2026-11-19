"use client";
import type { JSX as ReactJSX } from "react";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { useOrganizationRefresh } from "~/features/class-organization/shared";
import type { ClassPlan } from "./model";
import styles from "./organization.module.css";
export { ContinuityDialog } from "./continuity-form";

function planStatusText(
  open: boolean,
  alreadyPublished: boolean,
): {
  title: string;
  submitLabel: string;
  submitVariant: "primary" | "destructive";
} {
  if (!open)
    return { title: "Desfazer turma", submitLabel: "Desfazer turma", submitVariant: "destructive" };
  return {
    title: alreadyPublished ? "Reabrir turma" : "Abrir turma",
    submitLabel: "Abrir turma",
    submitVariant: "primary",
  };
}

export function PlanStatusDialog({
  plan,
  classroom,
  open,
  onClose,
  onFeedback,
}: (
  | { plan: ClassPlan; classroom?: never; open: boolean }
  | { classroom: { id: string; name: string }; plan?: never; open: false }
) & {
  onClose: () => void;
  onFeedback: (message: string) => void;
}): ReactJSX.Element {
  const refresh = useOrganizationRefresh();
  const saved = async (): Promise<void> => {
    await refresh();
    onFeedback(
      open
        ? "Turma aberta para receber alunos."
        : "Turma encerrada. Os vínculos afetados estão na revisão.",
    );
    onClose();
  };
  const status = trpc.semesterOrganization.planStatus.useMutation({ onSuccess: saved });
  const dissolve = trpc.semesterOrganization.dissolveClass.useMutation({ onSuccess: saved });
  const mutation = classroom ? dissolve : status;
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      {...planStatusText(open, Boolean(plan?.classId))}
      description={classroom?.name ?? plan?.name ?? ""}
      formId="plan-status"
      firstField=""
      pending={mutation.isPending}
      error={mutation.error?.message}
      onClose={onClose}
    >
      <form
        className={styles.form}
        id="plan-status"
        onSubmit={(event) => {
          event.preventDefault();
          if (mutation.isPending) return;
          if (classroom) dissolve.mutate({ id: classroom.id });
          else status.mutate({ id: plan.id, version: plan.version, open });
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
        : "Os alunos receberão o impedimento “Turma encerrada”, junto aos que já constam na ficha. As entradas futuras serão canceladas e os vínculos em andamento serão encerrados hoje."}
    </p>
  );
}
