"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { FormSection, FormRow } from "@lazuli/ui";
import { occurrenceCreateSchema } from "@lazuli/validators";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { trpc } from "~/lib/trpc";
import { CATEGORY, dateLabel, QueryState } from "./shared";
import { FollowUpDialog, NarrativeField, useValidation } from "./form-parts";
export function OccurrenceForm({ onClose }: { onClose: () => void }): ReactElement {
  const [values, setValues] = useState({
    classSessionId: "",
    studentId: "",
    category: "LEARNING",
    title: "",
    account: "",
    initialResponse: "",
  });
  const [classId, setClassId] = useState("");
  const validation = useValidation();
  const sessions = trpc.occurrences.sessions.useQuery();
  const roster = trpc.occurrences.roster.useQuery(
    { id: values.classSessionId },
    { enabled: Boolean(values.classSessionId) },
  );
  const router = useRouter();
  const utils = trpc.useUtils();
  const save = trpc.occurrences.create.useMutation({
    onSuccess: async (result) => {
      await utils.occurrences.invalidate();
      onClose();
      router.push(`/acompanhamento/ocorrencias/${result.id}`);
    },
  });
  const change = (name: keyof typeof values, value: string): void => {
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "classSessionId" ? { studentId: "" } : {}),
    }));
    validation.clear(name);
    save.reset();
  };
  return (
    <FollowUpDialog
      title="Registrar ocorrência"
      description="Registre o que aconteceu e a primeira resposta em sala."
      onClose={onClose}
      pending={save.isPending}
      firstField="occurrence-class"
      formId="occurrence-form"
      submitLabel="Registrar ocorrência"
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <QueryState
        pending={sessions.isPending}
        error={sessions.error}
        retry={() => void sessions.refetch()}
      />
      {sessions.data?.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          Nenhuma aula realizada disponível para registrar uma ocorrência.
        </p>
      )}
      <form
        id="occurrence-form"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(occurrenceCreateSchema, values);
          if (parsed) save.mutate(parsed);
        }}
      >
        <FormSection title="Contexto da aula">
          <SelectControl
            name="occurrence-class"
            label="Turma"
            value={classId}
            onChange={(value) => {
              setClassId(value);
              change("classSessionId", "");
            }}
            choices={Array.from(
              new Map(
                (sessions.data ?? []).map((row) => [
                  row.classId,
                  { value: row.classId, label: row.className },
                ]),
              ).values(),
            )}
          />
          <FormRow columns={2}>
            <SelectControl
              name="classSessionId"
              label="Aula"
              value={values.classSessionId}
              onChange={(value) => change("classSessionId", value)}
              choices={(sessions.data ?? [])
                .filter((row) => row.classId === classId)
                .map((row) => ({
                  value: row.id,
                  label: `${dateLabel(row.date)} · ${row.startTime.toISOString().slice(11, 16)}`,
                }))}
              error={validation.errors.classSessionId}
            />
            <SelectControl
              name="studentId"
              label="Aluno"
              value={values.studentId}
              onChange={(value) => change("studentId", value)}
              choices={(roster.data ?? []).map((row) => ({ value: row.id, label: row.fullName }))}
              error={validation.errors.studentId}
            />
          </FormRow>
        </FormSection>
        {roster.error && (
          <p role="alert" className="text-caption text-destructive">
            {roster.error.message}
          </p>
        )}
        <FormSection title="Relato">
          <SelectControl
            name="category"
            label="Contexto"
            value={values.category}
            onChange={(value) => change("category", value)}
            choices={Object.entries(CATEGORY).map(([value, label]) => ({ value, label }))}
          />
          <TextControl
            name="title"
            label="Título"
            value={values.title}
            onChange={(value) => change("title", value)}
            placeholder="Ex.: Dificuldade na atividade de listening"
            error={validation.errors.title}
          />
          <NarrativeField
            name="account"
            label="O que aconteceu?"
            value={values.account}
            onChange={(value) => change("account", value)}
            placeholder="Descreva os fatos observados e o contexto da atividade."
            error={validation.errors.account}
          />
        </FormSection>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-caption font-medium text-interactive">
            Registrar resposta inicial (opcional)
          </summary>
          <NarrativeField
            name="initialResponse"
            label="Resposta inicial"
            value={values.initialResponse}
            onChange={(value) => change("initialResponse", value)}
            placeholder="Ex.: Retomei a instrução com um exemplo e combinei uma revisão."
            error={validation.errors.initialResponse}
          />
        </details>
      </form>
    </FollowUpDialog>
  );
}
