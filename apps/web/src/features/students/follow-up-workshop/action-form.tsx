"use client";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { parseDateBR } from "~/lib/masks";
import { ACTION_LABELS, type ActionKind, type Case, type Draft, type Occurrence } from "./model";
import { ContinuityFields, LinkingFields, NarrativeFields, OccurrenceFields } from "./form-fields";

type Props = {
  kind: ActionKind;
  row: Case | undefined;
  sourceId: string;
  occurrences: Occurrence[];
  onSave: (draft: Draft) => void;
  onClose: () => void;
};
type FormError = { field: string; message: string };
const CONTINUITY = new Set<ActionKind>(["create", "note", "start", "reopen"]);
function firstField(kind: ActionKind): string {
  if (["create", "occurrence"].includes(kind)) return "title";
  if (kind === "assign") return "workshop-teacher";
  if (kind === "link") return "workshop-occurrence";
  return "body";
}
export function WorkshopActionDialog(props: Props): ReactElement {
  return (
    <TaskDialog
      title={ACTION_LABELS[props.kind]}
      description="Simulação do acompanhamento · registros fictícios"
      onClose={props.onClose}
      pending={false}
      firstField={firstField(props.kind)}
      formId="workshop-action"
      submitLabel={ACTION_LABELS[props.kind]}
    >
      <WorkshopActionForm {...props} />
    </TaskDialog>
  );
}
function initialDraft({ row, sourceId }: Props): Draft {
  return {
    title: "",
    body: "",
    teacher: row?.teacher ?? "Beatriz Albuquerque",
    nextStep: row?.nextStep ?? "",
    due: row?.due ?? "",
    occurrenceIds: row?.occurrenceIds ?? (sourceId ? [sourceId] : []),
    lesson: "12/10/2026 · Connect 1",
    category: "Aprendizagem",
    response: "",
  };
}
function validate(kind: ActionKind, draft: Draft): FormError | null {
  if (["create", "occurrence"].includes(kind) && !draft.title.trim())
    return { field: "title", message: "Informe um título para o registro." };
  if (kind !== "link" && !draft.body.trim())
    return { field: "body", message: "Descreva o contexto para preservar o histórico." };
  if (CONTINUITY.has(kind) && !draft.nextStep.trim())
    return { field: "nextStep", message: "Combine o próximo passo antes de salvar." };
  if (CONTINUITY.has(kind) && draft.due && !parseDateBR(draft.due))
    return { field: "due", message: "Informe uma data válida no formato dd/mm/aaaa." };
  return null;
}
export function WorkshopActionForm(props: Props): ReactElement {
  const { kind, occurrences, onSave, onClose } = props;
  const [draft, setDraft] = useState(() => initialDraft(props));
  const [error, setError] = useState<FormError | null>(null);
  const change = (key: keyof Draft, value: string | string[]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };
  const values = { kind, draft, change, error };
  return (
    <form
      id="workshop-action"
      noValidate
      className="grid gap-5 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validate(kind, draft);
        if (problem) {
          setError(problem);
          document.querySelector<HTMLElement>(`[name="${problem.field}"]`)?.focus();
          return;
        }
        onSave({
          ...draft,
          body:
            kind === "link"
              ? `${draft.occurrenceIds.length} ocorrência(s) vinculada(s).`
              : draft.body,
        });
      }}
    >
      <NarrativeFields values={values} />
      {kind === "occurrence" && <OccurrenceFields values={values} />}
      {CONTINUITY.has(kind) && <ContinuityFields values={values} />}
      {["create", "link"].includes(kind) && (
        <LinkingFields values={values} occurrences={occurrences} />
      )}
      <Button variant="ghost" size="sm" onClick={onClose}>
        Cancelar
      </Button>
    </form>
  );
}
