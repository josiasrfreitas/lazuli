"use client";
import { useState, type ReactElement } from "react";
import { FormRow, FormSection } from "@lazuli/ui";
import { occurrenceNoteSchema, interventionUpdateSchema } from "@lazuli/validators";
import type { InterventionUpdate } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { dateLabel, type Intervention } from "./shared";
import { FollowUpDialog, NarrativeField, useValidation } from "./form-parts";
export function OccurrenceNoteForm({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}): ReactElement {
  const [body, setBody] = useState("");
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.occurrences.note.useMutation({
    onSuccess: async () => {
      await utils.occurrences.invalidate();
      onClose();
    },
  });
  return (
    <FollowUpDialog
      title="Complementar relato"
      description="O relato original será preservado, com este complemento e sua autoria."
      formId="occurrence-note"
      firstField="note-body"
      submitLabel="Salvar complemento"
      onClose={onClose}
      pending={save.isPending}
      error={save.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="occurrence-note"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(occurrenceNoteSchema, { id, body });
          if (parsed) save.mutate(parsed);
        }}
      >
        <FormSection title="Complemento">
          <NarrativeField
            name="note-body"
            label="Contexto ou correção"
            value={body}
            placeholder="O que precisa ser acrescentado ou esclarecido?"
            onChange={(value) => {
              setBody(value);
              validation.clear("body");
              save.reset();
            }}
            error={validation.errors.body}
          />
        </FormSection>
      </form>
    </FollowUpDialog>
  );
}
const actionTitles = {
  NOTE: "Registrar acompanhamento",
  START: "Iniciar atuação",
  CONCLUDE: "Concluir intervenção",
  REOPEN: "Reabrir intervenção",
  ASSIGN: "Alterar professor responsável",
};
const bodyLabels = {
  NOTE: "O que foi feito ou observado?",
  START: "Como a atuação será iniciada?",
  CONCLUDE: "Resultado da intervenção",
  REOPEN: "Motivo da reabertura",
  ASSIGN: "Contexto da troca",
};
export function InterventionUpdateForm({
  row,
  kind,
  onClose,
}: {
  row: Intervention;
  kind: InterventionUpdate["kind"];
  onClose: () => void;
}): ReactElement {
  const [values, setValues] = useState({
    body: "",
    teacherId: "",
    nextStep: row.nextStep,
    dueOn: row.dueOn ? dateLabel(row.dueOn) : "",
  });
  const validation = useValidation();
  const teachers = trpc.interventions.teachers.useQuery(undefined, { enabled: kind === "ASSIGN" });
  const utils = trpc.useUtils();
  const save = trpc.interventions.update.useMutation({
    onSuccess: async () => {
      await utils.interventions.invalidate();
      onClose();
    },
  });
  const editableNext =
    kind !== "CONCLUDE" && kind !== "ASSIGN" && (row.status !== "CONCLUDED" || kind === "REOPEN");
  const change = (name: keyof typeof values, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    validation.clear(name);
    save.reset();
  };
  return (
    <FollowUpDialog
      title={actionTitles[kind]}
      description={row.student.fullName}
      formId="intervention-update"
      firstField={kind === "ASSIGN" ? "teacherId" : "follow-up-body"}
      submitLabel={kind === "CONCLUDE" ? "Confirmar conclusão" : "Salvar acompanhamento"}
      onClose={onClose}
      pending={save.isPending}
      error={save.error?.message ?? teachers.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="intervention-update"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(interventionUpdateSchema, {
            id: row.id,
            version: row.version,
            kind,
            body: values.body,
            ...(kind === "ASSIGN" ? { teacherId: values.teacherId } : {}),
            ...(editableNext
              ? {
                  nextStep: values.nextStep,
                  dueOn: values.dueOn ? (parseDateBR(values.dueOn) ?? "") : null,
                }
              : {}),
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <FormSection title="Acompanhamento">
          {kind === "ASSIGN" && (
            <SelectControl
              name="teacherId"
              label="Novo professor responsável"
              value={values.teacherId}
              onChange={(value) => change("teacherId", value)}
              choices={(teachers.data ?? [])
                .filter((teacher) => teacher.id !== row.teacherId)
                .map((teacher) => ({ value: teacher.id, label: teacher.name }))}
              error={validation.errors.teacherId}
            />
          )}
          <NarrativeField
            name="follow-up-body"
            label={bodyLabels[kind]}
            placeholder={
              kind === "CONCLUDE"
                ? "Descreva o resultado observado e como a atuação foi encerrada."
                : "Descreva a conversa, ação ou observação para dar continuidade ao caso."
            }
            value={values.body}
            onChange={(value) => change("body", value)}
            error={validation.errors.body}
          />
        </FormSection>
        {editableNext && (
          <FormSection title="Continuidade">
            <TextControl
              name="nextStep"
              label="Próximo passo"
              placeholder="Ex.: Retomar a atividade na próxima aula"
              value={values.nextStep}
              onChange={(value) => change("nextStep", value)}
              error={validation.errors.nextStep}
            />
            <FormRow>
              <TextControl
                name="dueOn"
                label="Prazo (opcional)"
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                value={values.dueOn}
                onChange={(value) => change("dueOn", maskDateBR(value))}
                error={validation.errors.dueOn}
              />
            </FormRow>
          </FormSection>
        )}
      </form>
    </FollowUpDialog>
  );
}
