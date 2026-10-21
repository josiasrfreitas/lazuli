import type { ReactElement } from "react";
import {
  Checkbox,
  Field,
  FieldError,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import type { ActionKind, Draft, Occurrence } from "./model";
export type FormValues = {
  kind: ActionKind;
  draft: Draft;
  change: (key: keyof Draft, value: string | string[]) => void;
  error: { field: string; message: string } | null;
};
type TextFieldProps = {
  name: keyof Draft;
  label: string;
  placeholder: string;
  multiline?: boolean;
  values: FormValues;
};
export function WorkshopTextField({
  name,
  label,
  placeholder,
  multiline,
  values,
}: TextFieldProps): ReactElement {
  const { draft, change, error } = values;
  const value = String(draft[name]);
  const invalid = error?.field === name;
  return (
    <Field name={name}>
      <Label htmlFor={multiline ? name : undefined}>{label}</Label>
      {multiline ? (
        <Textarea
          id={name}
          name={name}
          autoComplete="off"
          placeholder={placeholder}
          invalid={invalid}
          value={value}
          onChange={(event) => change(name, event.target.value)}
        />
      ) : (
        <Input
          name={name}
          autoComplete="off"
          size="sm"
          placeholder={placeholder}
          invalid={invalid}
          value={value}
          onChange={(event) =>
            change(name, name === "due" ? maskDateBR(event.target.value) : event.target.value)
          }
        />
      )}
      <FieldError match={invalid}>{invalid ? error.message : ""}</FieldError>
    </Field>
  );
}
export function TeacherField({ values }: { values: FormValues }): ReactElement {
  return (
    <Field>
      <Label>Professor responsável</Label>
      <SegmentedControl
        aria-label="Professor responsável"
        value={values.draft.teacher}
        onValueChange={(value) => {
          if (value) values.change("teacher", value);
        }}
      >
        {["Beatriz Albuquerque", "Rafael Lima"].map((teacher, index) => (
          <SegmentedControlItem
            id={index === 0 ? "workshop-teacher" : undefined}
            key={teacher}
            value={teacher}
          >
            {teacher}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}
function bodyLabel(kind: ActionKind): string {
  if (kind === "create") return "Objetivo da intervenção";
  if (kind === "conclude") return "Resultado observado";
  if (kind === "reopen") return "Motivo da reabertura";
  return "O que aconteceu ou foi observado?";
}
export function NarrativeFields({ values }: { values: FormValues }): ReactElement {
  const { kind } = values;
  return (
    <FormSection title="Registro pedagógico">
      {["create", "occurrence"].includes(kind) && (
        <WorkshopTextField
          name="title"
          label="Título"
          placeholder="Ex.: Apoio à produção escrita"
          values={values}
        />
      )}
      {["create", "assign"].includes(kind) && <TeacherField values={values} />}
      {kind !== "link" && (
        <WorkshopTextField
          name="body"
          label={bodyLabel(kind)}
          placeholder="Descreva os fatos e o contexto da atuação."
          multiline
          values={values}
        />
      )}
    </FormSection>
  );
}
export function OccurrenceFields({ values }: { values: FormValues }): ReactElement {
  return (
    <FormSection title="Contexto da aula">
      <p className="text-sm text-muted-foreground">Aula de exemplo · 12/10/2026 · Connect 1</p>
      <SegmentedControl
        aria-label="Categoria"
        value={values.draft.category}
        onValueChange={(value) => {
          if (value) values.change("category", value);
        }}
      >
        {["Aprendizagem", "Participação", "Comportamento"].map((category) => (
          <SegmentedControlItem key={category} value={category}>
            {category}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <WorkshopTextField
        name="response"
        label="Resposta inicial (opcional)"
        placeholder="Ex.: Retomei as instruções individualmente"
        values={values}
      />
    </FormSection>
  );
}
export function ContinuityFields({ values }: { values: FormValues }): ReactElement {
  return (
    <FormSection title="Continuidade">
      <WorkshopTextField
        name="nextStep"
        label="Próximo passo"
        placeholder="Ex.: Retomar o texto na próxima aula"
        values={values}
      />
      <div className="max-w-48">
        <WorkshopTextField
          name="due"
          label="Revisar até (opcional)"
          placeholder="dd/mm/aaaa"
          values={values}
        />
      </div>
    </FormSection>
  );
}
export function LinkingFields({
  values,
  occurrences,
}: {
  values: FormValues;
  occurrences: Occurrence[];
}): ReactElement {
  return (
    <FormSection title="Ocorrências motivadoras">
      {occurrences.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma ocorrência. A intervenção pode ser aberta diretamente.
        </p>
      )}
      {occurrences.map((row, index) => (
        <label key={row.id} className="flex items-start gap-3 py-2 text-sm">
          <Checkbox
            aria-label={row.title}
            name={index === 0 ? "workshop-occurrence" : row.id}
            checked={values.draft.occurrenceIds.includes(row.id)}
            onCheckedChange={(checked) =>
              values.change(
                "occurrenceIds",
                checked
                  ? [...values.draft.occurrenceIds, row.id]
                  : values.draft.occurrenceIds.filter((id) => id !== row.id),
              )
            }
          />
          <span>
            {row.title}
            <span className="block text-sm text-muted-foreground">{row.lesson}</span>
          </span>
        </label>
      ))}
    </FormSection>
  );
}
