"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { RouterInputs } from "@lazuli/api";
import { Trash2 } from "lucide-react";
import { Button } from "@lazuli/ui";
import { CalendarChangeFields, draftSchema, type CalendarDraft } from "./change-fields";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { CalendarImpact } from "./impact";
import type { AcademicYear } from "./model";

export type CalendarChange = RouterInputs["calendar"]["academic"]["changes"]["preview"];
type Period = AcademicYear["periods"][number];
type Interruption = AcademicYear["interruptions"][number];
type ChangeFormProps = {
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onBack?: (() => void) | undefined;
  mode: "period" | "interruption";
  item?: Period | Interruption | undefined;
  onClose: () => void;
  onSaved?: ((semesterId: string) => void) | undefined;
  initialDate?: string | undefined;
};
type ChangeFormState = {
  item: ChangeFormProps["item"];
  draft: CalendarDraft;
  change: CalendarChange | null;
  setChange: (change: CalendarChange | null) => void;
  validation: ReturnType<typeof useValidation>;
  preview: ReturnType<typeof trpc.calendar.academic.changes.preview.useMutation>;
  update: (key: keyof CalendarDraft, value: string) => void;
  prepare: (value: CalendarChange) => void;
};
export function CalendarChangeForm(props: ChangeFormProps): ReactElement {
  const state = useChangeForm(props);
  const { change, preview, setChange } = state;
  const { embedded = false, onPendingChange, onClose, onSaved } = props;
  if (change && preview.data)
    return (
      <CalendarImpact
        embedded={embedded}
        onPendingChange={onPendingChange}
        change={change}
        preview={preview.data}
        onBack={() => {
          preview.reset();
          setChange(null);
        }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  return <ChangeDialog props={props} state={state} />;
}
function useChangeForm({
  item: initialItem,
  initialDate,
  onPendingChange,
}: ChangeFormProps): ChangeFormState {
  const [item] = useState(initialItem);
  const [draft, setDraft] = useState<CalendarDraft>(() => initialChangeDraft(item, initialDate));
  const [change, setChange] = useState<CalendarChange | null>(null);
  const validation = useValidation();
  const preview = trpc.calendar.academic.changes.preview.useMutation();
  useEffect(() => {
    onPendingChange?.(preview.isPending);
    return () => onPendingChange?.(false);
  }, [preview.isPending, onPendingChange]);
  function update(key: keyof typeof draft, value: string): void {
    setDraft((current) => ({ ...current, [key]: value }));
    validation.clear(key);
  }
  function prepare(value: CalendarChange): void {
    setChange(value);
    preview.mutate(value);
  }
  return { item, draft, change, setChange, validation, preview, update, prepare };
}
function ChangeDialog({
  props: { mode, embedded = false, onBack, onClose },
  state,
}: {
  props: ChangeFormProps;
  state: ChangeFormState;
}): ReactElement {
  const { item, validation, preview } = state;
  return (
    <TaskDialog
      embedded={embedded}
      hideCancel={embedded}
      onBack={onBack}
      compactHeader
      actionSize="sm"
      title={changeDialogTitle(mode, item)}
      description={
        mode === "period"
          ? "Defina os limites das aulas regulares. Você confere os impactos antes de aplicar."
          : "Este intervalo suspende as atividades acadêmicas de toda a escola."
      }
      formId="calendar-change"
      firstField="calendar-title"
      submitLabel="Conferir impactos"
      pendingLabel="Conferindo impactos…"
      pending={preview.isPending}
      error={preview.error?.message}
      bodyRef={validation.body}
      onClose={onClose}
    >
      <ChangeDialogFields mode={mode} state={state} />
    </TaskDialog>
  );
}

function ChangeDialogFields({
  mode,
  state,
}: {
  mode: ChangeFormProps["mode"];
  state: ChangeFormState;
}): ReactElement {
  const { item, draft, validation, preview, update, prepare } = state;
  return (
    <>
      {" "}
      <CalendarChangeFields
        mode={mode}
        draft={draft}
        errors={validation.errors}
        pending={preview.isPending}
        update={update}
        submit={(event) => {
          event.preventDefault();
          if (preview.isPending) return;
          const values = validation.validate(draftSchema, draft);
          if (!values) return;
          const revision = item
            ? { id: item.id, expectedUpdatedAt: item.updatedAt.toISOString() }
            : {};
          const range = { from: parseDateBR(values.from)!, through: parseDateBR(values.through)! };
          prepare(
            mode === "period"
              ? { action: "period", ...revision, ...range, name: values.title }
              : {
                  action: "interruption",
                  ...revision,
                  ...range,
                  title: values.title,
                  description: values.description || null,
                  kind: values.kind,
                },
          );
        }}
      />
      {item && mode === "interruption" && (
        <Button
          type="button"
          variant="destructive-ghost"
          size="sm"
          disabled={preview.isPending}
          onClick={() =>
            prepare({
              action: "removeInterruption",
              id: item.id,
              expectedUpdatedAt: item.updatedAt.toISOString(),
            })
          }
        >
          <Trash2 aria-hidden="true" /> Remover intervalo…
        </Button>
      )}
    </>
  );
}
const DATE_LENGTH = 10;
function dateDraft(value: Date | undefined, initialDate: string | undefined): string {
  if (value) return formatDateOnlyBR(value.toISOString().slice(0, DATE_LENGTH));
  return initialDate ? formatDateOnlyBR(initialDate) : "";
}
function initialChangeDraft(
  item: Period | Interruption | undefined,
  initialDate: string | undefined,
): CalendarDraft {
  if (!item)
    return {
      title: "",
      from: dateDraft(undefined, initialDate),
      through: dateDraft(undefined, initialDate),
      description: "",
      kind: "RECESS",
    };
  if ("name" in item)
    return {
      title: item.name,
      from: dateDraft(item.startDate, initialDate),
      through: dateDraft(item.endDate, initialDate),
      description: "",
      kind: "RECESS",
    };
  return {
    title: item.title,
    from: dateDraft(item.fromDate, initialDate),
    through: dateDraft(item.throughDate, initialDate),
    description: item.description ?? "",
    kind: item.kind,
  };
}
function changeDialogTitle(mode: ChangeFormProps["mode"], item: ChangeFormProps["item"]): string {
  if (mode === "period") return `${item ? "Editar" : "Novo"} semestre`;
  return item ? "Editar feriado ou recesso" : "Feriado ou recesso";
}
