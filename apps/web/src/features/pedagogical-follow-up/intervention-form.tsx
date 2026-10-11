"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Field, FieldError, FormRow, FormSection } from "@lazuli/ui";
import { interventionCreateSchema } from "@lazuli/validators";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { trpc } from "~/lib/trpc";
import { dateLabel, type Occurrence, type OccurrenceRow, QueryState } from "./shared";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
export function InterventionForm({
  source,
  onClose,
}: {
  source: Occurrence;
  onClose: () => void;
}): ReactElement {
  const [step, setStep] = useState(0);
  const [ids, setIds] = useState([source.id]);
  const [values, setValues] = useState({
    title: "",
    teacherId: "",
    objective: "",
    nextStep: "",
    dueOn: "",
  });
  const validation = useValidation();
  const rows = trpc.occurrences.forStudent.useQuery({ studentId: source.studentId });
  const teachers = trpc.interventions.teachers.useQuery();
  const utils = trpc.useUtils();
  const router = useRouter();
  const save = trpc.interventions.create.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.interventions.invalidate(), utils.occurrences.invalidate()]);
      onClose();
      router.push(`/acompanhamento/intervencoes/${result.id}`);
    },
  });
  const change = (name: keyof typeof values, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    validation.clear(name);
    save.reset();
  };
  return (
    <TaskDialog
      title="Organizar intervenção"
      description={`${source.student.fullName} · ${step === 0 ? "Reúna os relatos que motivam a atuação." : "Combine a atuação e o próximo passo."}`}
      firstField={step === 0 ? "motivating-first" : "intervention-title"}
      formId="intervention-form"
      submitLabel={step === 0 ? "Definir atuação" : "Abrir intervenção"}
      pending={save.isPending}
      onClose={onClose}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="intervention-form"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          if (step === 0) {
            if (ids.length < 2) {
              validation.validate(interventionCreateSchema.pick({ occurrenceIds: true }), {
                occurrenceIds: ids,
              });
              return;
            }
            setStep(1);
            requestAnimationFrame(() => document.getElementById("intervention-title")?.focus());
            return;
          }
          const parsed = validation.validate(interventionCreateSchema, {
            ...values,
            occurrenceIds: ids,
            dueOn: values.dueOn ? (parseDateBR(values.dueOn) ?? "") : null,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        {step === 0 ? (
          <>
            <QueryState
              pending={rows.isPending}
              error={rows.error}
              retry={() => void rows.refetch()}
            />
            <MotivatingOccurrenceFields
              rows={rows.data ?? []}
              ids={ids}
              error={validation.errors.occurrenceIds}
              onChange={(next) => {
                setIds(next);
                validation.clear("occurrenceIds");
              }}
            />
          </>
        ) : (
          <InterventionFields
            values={values}
            change={change}
            errors={validation.errors}
            teachers={teachers.data ?? []}
          />
        )}
        {teachers.error && (
          <p role="alert" className="text-caption text-destructive">
            {teachers.error.message}
          </p>
        )}
        {step === 1 && (
          <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
            Rever {ids.length} ocorrências selecionadas
          </Button>
        )}
      </form>
    </TaskDialog>
  );
}
type Fields = {
  title: string;
  teacherId: string;
  objective: string;
  nextStep: string;
  dueOn: string;
};
export function InterventionFields({
  values,
  change,
  errors,
  teachers,
}: {
  values: Fields;
  change: (name: keyof Fields, value: string) => void;
  errors: Record<string, string>;
  teachers: { id: string; name: string }[];
}): ReactElement {
  return (
    <FormSection title="Atuação do professor">
      <TextControl
        name="intervention-title"
        label="Título da intervenção"
        value={values.title}
        onChange={(value) => change("title", value)}
        placeholder="Ex.: Retomar a participação nas atividades orais"
        error={errors.title}
      />
      <FormRow columns={2}>
        <SelectControl
          name="teacherId"
          label="Professor responsável"
          value={values.teacherId}
          onChange={(value) => change("teacherId", value)}
          choices={teachers.map((row) => ({ value: row.id, label: row.name }))}
          error={errors.teacherId}
        />
        <TextControl
          name="dueOn"
          label="Prazo (opcional)"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={values.dueOn}
          onChange={(value) => change("dueOn", maskDateBR(value))}
          error={errors.dueOn}
        />
      </FormRow>
      <NarrativeField
        name="objective"
        label="Objetivo da atuação"
        value={values.objective}
        onChange={(value) => change("objective", value)}
        placeholder="Qual mudança queremos observar com o aluno?"
        error={errors.objective}
      />
      <TextControl
        name="nextStep"
        label="Próximo passo"
        value={values.nextStep}
        onChange={(value) => change("nextStep", value)}
        placeholder="Ex.: Conversar com o aluno antes da próxima aula"
        error={errors.nextStep}
      />
    </FormSection>
  );
}

export function MotivatingOccurrenceFields({
  rows,
  ids,
  error,
  onChange,
}: {
  rows: OccurrenceRow[];
  ids: string[];
  error?: string | undefined;
  onChange: (ids: string[]) => void;
}): ReactElement {
  return (
    <FormSection title="Ocorrências motivadoras">
      <Field name="occurrenceIds">
        <p className="text-caption text-muted-foreground">
          Selecione pelo menos dois relatos. Eles continuam disponíveis no histórico do aluno.
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto">
          {rows.map((row, index) => (
            <label
              key={row.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3"
            >
              <Checkbox
                id={index === 0 ? "motivating-first" : `motivating-${row.id}`}
                name="occurrenceIds"
                checked={ids.includes(row.id)}
                invalid={Boolean(error)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...ids, row.id] : ids.filter((id) => id !== row.id))
                }
              />
              <span className="grid gap-1">
                <span className="text-sm font-medium">{row.title}</span>
                <span className="text-caption text-muted-foreground">
                  {dateLabel(row.classSession.date)} · {row.recordedBy.name}
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError match={Boolean(error)}>{error}</FieldError>
      </Field>
    </FormSection>
  );
}
