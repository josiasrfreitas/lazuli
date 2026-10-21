"use client";
import { Trash2 } from "lucide-react";
import { useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
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
  const [values, setValues] = useState(() => windowDraft(openedData));
  const validation = useValidation();
  const save = trpc.planning.saveWindow.useMutation({ onSuccess: useSaved(onClose) });
  const change = useFieldChange({ setValues, clear: validation.clear, reset: save.reset });
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
          const parsed = validation.validate(
            stagePlanWindowSchema,
            windowInput(openedData, values),
          );
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
  const [plan] = useState(data.plan!);
  const [values, setValues] = useState(() => itemDraft(data, item));
  const validation = useValidation();
  const save = trpc.planning.saveItem.useMutation({ onSuccess: useSaved(onClose) });
  const change = useFieldChange({ setValues, clear: validation.clear, reset: save.reset });
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
          const parsed = validation.validate(
            stagePlanItemSchema,
            itemInput(data, { values, version: plan.version, item }),
          );
          if (parsed) save.mutate(parsed);
        }}
      >
        <UpcomingDates sessions={data.upcoming} />
        <ItemFields
          values={values}
          errors={validation.errors}
          editing={Boolean(item)}
          change={change}
        />
      </form>
      {item && <RemoveAction item={item} pending={save.isPending} onRemove={onRemove} />}
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
  const changeReason = (value: string): void => {
    setReason(value);
    validation.clear("reason");
    save.reset();
  };
  return (
    <TaskDialog
      title="Retirar atividade do roteiro"
      submitVariant="destructive"
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
        <RevisionReason value={reason} error={validation.errors.reason} onChange={changeReason} />
      </form>
    </TaskDialog>
  );
}

function windowDraft({ plan, scope }: Planning): WindowDraft {
  return {
    plannedStartOn: dateLabel(
      plan?.plannedStartOn ?? scope.progressStartOn ?? scope.semester.startOn,
    ),
    plannedEndOn: windowEndLabel({ plan, scope }),
    objective: plan?.objective ?? "",
    reason: "",
  };
}

function windowInput(data: Planning, values: WindowDraft): object {
  return {
    ...targetFor(data),
    version: data.plan?.version ?? 0,
    plannedStartOn: parseDateBR(values.plannedStartOn) ?? "",
    plannedEndOn: parseDateBR(values.plannedEndOn) ?? "",
    objective: values.objective || null,
    ...(data.plan ? { reason: values.reason } : {}),
  };
}

function itemDraft(data: Planning, item: PlannedItem | null): ItemDraft {
  if (item)
    return {
      plannedOn: dateLabel(item.plannedOn),
      kind: item.kind,
      title: item.title,
      reference: item.reference ?? "",
      pageFrom: pageDraft(item.pageFrom),
      pageTo: pageDraft(item.pageTo),
      reason: "",
    };
  const plan = data.plan!;
  const date = data.upcoming.find(
    (session) => session.date >= plan.plannedStartOn && session.date <= plan.plannedEndOn,
  )?.date;
  const nextDate =
    date ?? [plan.plannedStartOn, data.scope.today, plan.plannedEndOn].toSorted()[1]!;
  return {
    plannedOn: dateLabel(nextDate),
    kind: "CONTENT",
    title: "",
    reference: "",
    pageFrom: "",
    pageTo: "",
    reason: "",
  };
}
function pageDraft(value: number | null): string {
  return value === null ? "" : String(value);
}

function itemInput(
  data: Planning,
  { values, version, item }: { values: ItemDraft; version: number; item: PlannedItem | null },
): object {
  return {
    ...targetFor(data),
    ...values,
    version,
    plannedOn: parseDateBR(values.plannedOn) ?? "",
    reference: values.reference || null,
    pageFrom: values.pageFrom ? Number(values.pageFrom) : null,
    pageTo: values.pageTo ? Number(values.pageTo) : null,
    reason: item ? values.reason : undefined,
    ...(item ? { itemId: item.id } : {}),
  };
}

function RemoveAction({
  item,
  pending,
  onRemove,
}: {
  item: PlannedItem;
  pending: boolean;
  onRemove: (item: PlannedItem) => void;
}): ReactElement {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => onRemove(item)}>
        <Trash2 aria-hidden />
        Retirar do roteiro
      </Button>
    </div>
  );
}

function useFieldChange<T>({
  setValues,
  clear,
  reset,
}: {
  setValues: Dispatch<SetStateAction<T>>;
  clear: (name: string) => void;
  reset: () => void;
}): (name: keyof T & string, value: string) => void {
  return (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    clear(name);
    reset();
  };
}

function windowEndLabel({ plan, scope }: Pick<Planning, "plan" | "scope">): string {
  if (plan) return dateLabel(plan.plannedEndOn);
  return scope.student ? "" : dateLabel(scope.semester.endOn);
}

function UpcomingDates({ sessions }: { sessions: Planning["upcoming"] }): ReactElement {
  const dates = sessions
    .map((session) => `${dateLabel(session.date)} às ${session.time}`)
    .join(" · ");
  return (
    <p className="text-caption text-muted-foreground">
      {dates
        ? `Datas da turma a partir de hoje: ${dates}.`
        : "Não há aulas previstas nesta turma a partir de hoje."}
    </p>
  );
}
