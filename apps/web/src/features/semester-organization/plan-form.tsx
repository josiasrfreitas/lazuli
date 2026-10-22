"use client";

import type { JSX as ReactJSX } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TaskDialog } from "~/features/shared/task-form";
import { stageLabel } from "~/features/class-organization/model";
import { useClassPlanModel, type ClassPlanProps } from "./class-plan-model";
import { ClassPlanFields } from "./class-plan-fields";

export function ClassPlanForm(props: ClassPlanProps): ReactJSX.Element {
  const options = trpc.classes.formOptions.useQuery();
  const model = useClassPlanModel(props);
  if (options.isPending) return <PlanLoading plan={props.plan} onClose={props.onClose} />;
  return (
    <TaskDialog
      key="ready-plan"
      compactHeader
      actionSize="sm"
      title={classPlanTitle(props)}
      description="Horário, professor e composição podem ser preparados aos poucos."
      formId="semester-plan"
      firstField="plan-name"
      submitLabel="Salvar turma"
      onClose={props.onClose}
      pending={model.pending}
      error={model.error ?? options.error?.message}
      bodyRef={model.validation.body}
    >
      <ClassPlanFields group={props.group} model={model} options={options.data} />
    </TaskDialog>
  );
}

function classPlanTitle({ plan, group }: ClassPlanProps): string {
  if (plan) return "Editar turma";
  if (group) return `Formar turma · ${stageLabel(group.stageCode)}`;
  return "Nova turma";
}

function PlanLoading({
  plan,
  onClose,
}: Pick<ClassPlanProps, "plan" | "onClose">): ReactJSX.Element {
  return (
    <TaskDialog
      key="loading-plan"
      compactHeader
      actionSize="sm"
      title={plan ? "Editar turma" : "Nova turma"}
      description="Carregando professores e estágios…"
      formId="plan-loading"
      firstField=""
      submitLabel="Salvar turma"
      submitDisabled
      pending={false}
      onClose={onClose}
    >
      <div className="grid gap-4 py-4" role="status" aria-label="Carregando turma">
        <InlineSkeleton className="h-12 w-full" />
        <InlineSkeleton className="h-12 w-full" />
        <InlineSkeleton className="h-24 w-full" />
      </div>
    </TaskDialog>
  );
}

export { SemesterForm } from "./semester-create-form";
