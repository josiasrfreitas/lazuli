"use client";
import { useState } from "react";
import type { RouterInputs } from "@lazuli/api";
import { Button } from "@lazuli/ui";
import { CalendarChangeFields, draftSchema } from "./change-fields";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { CalendarImpact } from "./impact";
import type { AcademicYear } from "./model";

export type CalendarChange = RouterInputs["calendar"]["academic"]["changes"]["preview"];
type Period = AcademicYear["periods"][number];
type Interruption = AcademicYear["interruptions"][number];
export function CalendarChangeForm({
  mode,
  item: initialItem,
  onClose,
  onSaved,
}: {
  mode: "period" | "interruption";
  item?: Period | Interruption | undefined;
  onClose: () => void;
  onSaved?: ((semesterId: string) => void) | undefined;
}) {
  const [item] = useState(initialItem);
  const [draft, setDraft] = useState(() => ({
    title: item ? ("name" in item ? item.name : item.title) : "",
    from: item
      ? formatDateOnlyBR(
          ("startDate" in item ? item.startDate : item.fromDate).toISOString().slice(0, 10),
        )
      : "",
    through: item
      ? formatDateOnlyBR(
          ("endDate" in item ? item.endDate : item.throughDate).toISOString().slice(0, 10),
        )
      : "",
    description: item && "description" in item ? (item.description ?? "") : "",
    kind: item && "kind" in item ? item.kind : ("RECESS" as Interruption["kind"]),
  }));
  const [change, setChange] = useState<CalendarChange | null>(null);
  const validation = useValidation();
  const preview = trpc.calendar.academic.changes.preview.useMutation();
  function update(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    validation.clear(key);
  }
  function prepare(value: CalendarChange) {
    setChange(value);
    preview.mutate(value);
  }
  if (change && preview.data)
    return (
      <CalendarImpact
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
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={`${item ? "Editar" : "Novo"} ${mode === "period" ? "semestre" : "recesso"}`}
      description={
        mode === "period"
          ? "As turmas regulares seguem os limites deste semestre."
          : "Suspende as atividades acadêmicas de toda a escola."
      }
      formId="calendar-change"
      firstField="calendar-title"
      submitLabel="Conferir impactos"
      pending={preview.isPending}
      error={preview.error?.message}
      bodyRef={validation.body}
      onClose={onClose}
    >
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
          variant="ghost"
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
          Remover recesso…
        </Button>
      )}
    </TaskDialog>
  );
}
