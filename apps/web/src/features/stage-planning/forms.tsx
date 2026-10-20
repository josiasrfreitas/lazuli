"use client";
import { Trash2 } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import {
  stagePlanWindowSchema,
  stagePlanItemSchema,
  stagePlanRemoveSchema,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import {
  WindowFields,
  ItemFields,
  RevisionReason,
  type WindowDraft,
  type ItemDraft,
} from "./form-fields";
import { dateLabel, targetFor, type Planning, type PlannedItem } from "./shared";
type FormProps = { data: Planning; onClose: () => void };
function useSaved(onClose: () => void) {
  const utils = trpc.useUtils();
  return async () => {
    await utils.planning.invalidate();
    onClose();
  };
}
export function PlanWindowForm({ data, onClose }: FormProps): ReactElement {
  const [openedData] = useState(data);
  const { plan, scope } = openedData;
  const [values, setValues] = useState<WindowDraft>({
    plannedStartOn: dateLabel(
      plan?.plannedStartOn ?? scope.progressStartOn ?? scope.semester.startOn,
    ),
    plannedEndOn: plan
      ? dateLabel(plan.plannedEndOn)
      : scope.student
        ? ""
        : dateLabel(scope.semester.endOn),
    objective: plan?.objective ?? "",
    reason: "",
  });
  const validation = useValidation();
  const save = trpc.planning.saveWindow.useMutation({ onSuccess: useSaved(onClose) });
  const change = (name: keyof WindowDraft, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    validation.clear(name);
    save.reset();
  };
  return (
    <TaskDialog
      title={plan ? "Revisar período e objetivo" : "Iniciar planejamento"}
      description={
        scope.student
          ? `${scope.student.fullName} · o prazo do PPT pode atravessar semestres.`
          : `${scope.class.name} · período letivo de ${dateLabel(scope.semester.startOn)} a ${dateLabel(scope.semester.endOn)}.`
      }
      formId="plan-window-form"
      firstField="plannedStartOn"
      pending={save.isPending}
      onClose={onClose}
      submitLabel={plan ? "Salvar revisão" : "Criar plano"}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="plan-window-form"
        className="grid gap-4 pt-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(stagePlanWindowSchema, {
            ...targetFor(data),
            version: plan?.version ?? 0,
            plannedStartOn: parseDateBR(values.plannedStartOn) ?? "",
            plannedEndOn: parseDateBR(values.plannedEndOn) ?? "",
            objective: values.objective || null,
            ...(plan ? { reason: values.reason } : {}),
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <WindowFields
          values={values}
          errors={validation.errors}
          editing={Boolean(plan)}
          change={change}
        />
      </form>
    </TaskDialog>
  );
}
export function PlanItemForm({
  data,
  item,
  onClose,
  onRemove,
}: FormProps & { item: PlannedItem | null; onRemove: (item: PlannedItem) => void }): ReactElement {
  const [version] = useState(data.plan!.version);
  const plan = data.plan!;
  const nextDate =
    data.upcoming.find(
      (session) => session.date >= plan.plannedStartOn && session.date <= plan.plannedEndOn,
    )?.date ??
    (data.scope.today < plan.plannedStartOn
      ? plan.plannedStartOn
      : data.scope.today > plan.plannedEndOn
        ? plan.plannedEndOn
        : data.scope.today);
  const [values, setValues] = useState<ItemDraft>({
    plannedOn: dateLabel(item?.plannedOn ?? nextDate),
    kind: item?.kind ?? "CONTENT",
    title: item?.title ?? "",
    reference: item?.reference ?? "",
    pageFrom: item?.pageFrom?.toString() ?? "",
    pageTo: item?.pageTo?.toString() ?? "",
    reason: "",
  });
  const validation = useValidation();
  const save = trpc.planning.saveItem.useMutation({ onSuccess: useSaved(onClose) });
  const change = (name: keyof ItemDraft, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    validation.clear(name);
    save.reset();
  };
  return (
    <TaskDialog
      title={item ? "Revisar atividade" : "Adicionar atividade"}
      description={`${data.scope.stage.name} · de ${dateLabel(plan.plannedStartOn)} a ${dateLabel(plan.plannedEndOn)}.`}
      formId="plan-item-form"
      firstField="plannedOn"
      pending={save.isPending}
      onClose={onClose}
      submitLabel={item ? "Salvar revisão" : "Adicionar ao roteiro"}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="plan-item-form"
        className="grid gap-4 pt-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(stagePlanItemSchema, {
            ...targetFor(data),
            ...values,
            version,
            plannedOn: parseDateBR(values.plannedOn) ?? "",
            reference: values.reference || null,
            pageFrom: values.pageFrom ? Number(values.pageFrom) : null,
            pageTo: values.pageTo ? Number(values.pageTo) : null,
            reason: item ? values.reason : undefined,
            ...(item ? { itemId: item.id } : {}),
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <ItemFields
          values={values}
          errors={validation.errors}
          editing={Boolean(item)}
          change={change}
        />
      </form>
      {item && (
        <div className="mt-4 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={() => onRemove(item)}
          >
            <Trash2 aria-hidden="true" />
            Retirar do roteiro
          </Button>
        </div>
      )}
    </TaskDialog>
  );
}
export function PlanRemoveForm({
  data,
  item,
  onClose,
}: FormProps & { item: PlannedItem }): ReactElement {
  const [version] = useState(data.plan!.version);
  const [reason, setReason] = useState("");
  const validation = useValidation();
  const save = trpc.planning.removeItem.useMutation({ onSuccess: useSaved(onClose) });
  return (
    <TaskDialog
      title="Retirar atividade do roteiro"
      description={`“${item.title}” será preservada nas versões anteriores do plano.`}
      formId="plan-remove-form"
      firstField="reason"
      pending={save.isPending}
      onClose={onClose}
      submitLabel="Retirar atividade"
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="plan-remove-form"
        className="grid gap-4 pt-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(stagePlanRemoveSchema, {
            ...targetFor(data),
            version,
            itemId: item.id,
            reason,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <RevisionReason
          value={reason}
          error={validation.errors.reason}
          onChange={(value) => {
            setReason(value);
            validation.clear("reason");
            save.reset();
          }}
        />
      </form>
    </TaskDialog>
  );
}
