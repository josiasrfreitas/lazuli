import type { FormEvent, ReactElement } from "react";
import { z } from "@lazuli/validators";
import { Field, FieldError, FormRow, FormSection, Input, Label, Textarea } from "@lazuli/ui";
import { maskDateBR, maskTime24, parseDateBR } from "~/lib/masks";

export type EventDraft = {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};
const TITLE_LIMIT = 160;
const DESCRIPTION_LIMIT = 2000;
const DATE_INPUT_LENGTH = 10;
const TIME_INPUT_LENGTH = 5;
const date = z.string().refine((value) => Boolean(parseDateBR(value)), "Informe uma data válida.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário entre 00:00 e 23:59.");
export const eventDraftSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título do evento.").max(TITLE_LIMIT),
    description: z.string().trim().max(DESCRIPTION_LIMIT),
    startDate: date,
    startTime: time,
    endDate: date,
    endTime: time,
  })
  .refine(
    (value) => {
      const start = parseDateBR(value.startDate),
        end = parseDateBR(value.endDate);
      return !start || !end || `${end}T${value.endTime}` > `${start}T${value.startTime}`;
    },
    { path: ["endTime"], message: "O fim deve ser posterior ao início." },
  );

type EventFieldsProps = {
  values: EventDraft;
  errors: Record<string, string>;
  pending: boolean;
  change: (name: keyof EventDraft, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
export function AcademicEventFields({
  values,
  errors,
  pending,
  change,
  submit,
}: EventFieldsProps): ReactElement {
  const field = (config: FieldConfig): ReactElement =>
    eventField(config, { values, errors, change });
  return (
    <form id="academic-event" noValidate onSubmit={submit} className="grid gap-4">
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {field({ name: "title", label: "Título", placeholder: "Ex.: Encontro cultural" })}
        <FormSection title="Horários de São Paulo">
          <FormRow columns={2} className="grid-cols-2">
            {field({
              name: "startDate",
              label: "Data de início",
              placeholder: "dd/mm/aaaa",
              kind: "date",
            })}
            {field({
              name: "startTime",
              label: "Hora de início",
              placeholder: "hh:mm",
              kind: "time",
            })}
          </FormRow>
          <FormRow columns={2} className="grid-cols-2">
            {field({
              name: "endDate",
              label: "Data de fim",
              placeholder: "dd/mm/aaaa",
              kind: "date",
            })}
            {field({ name: "endTime", label: "Hora de fim", placeholder: "hh:mm", kind: "time" })}
          </FormRow>
        </FormSection>
        <Field name="description">
          <Label htmlFor="event-description">Descrição (opcional)</Label>
          <Textarea
            id="event-description"
            name="description"
            rows={2}
            size="sm"
            autoComplete="off"
            placeholder="Informações úteis sobre o evento"
            value={values.description}
            maxLength={DESCRIPTION_LIMIT}
            onChange={(event) => change("description", event.target.value)}
          />
        </Field>
      </fieldset>
    </form>
  );
}

type FieldKind = "date" | "time" | "text";
type FieldConfig = { name: keyof EventDraft; label: string; placeholder: string; kind?: FieldKind };
function eventField(
  { name, label, placeholder, kind = "text" }: FieldConfig,
  { values, errors, change }: Pick<EventFieldsProps, "values" | "errors" | "change">,
): ReactElement {
  const error = errors[name];
  return (
    <Field name={name} invalid={Boolean(error)}>
      <Label htmlFor={`event-${name}`}>{label}</Label>
      <Input
        id={`event-${name}`}
        name={name}
        size="sm"
        autoComplete="off"
        placeholder={placeholder}
        value={values[name]}
        invalid={Boolean(error)}
        aria-describedby={error ? `event-${name}-error` : undefined}
        inputMode={kind === "text" ? "text" : "numeric"}
        maxLength={fieldLength(kind)}
        onChange={(event) => change(name, maskedValue(kind, event.target.value))}
      />
      <FieldError id={`event-${name}-error`} match={Boolean(error)}>
        {error}
      </FieldError>
    </Field>
  );
}
function fieldLength(kind: FieldKind): number {
  if (kind === "date") return DATE_INPUT_LENGTH;
  return kind === "time" ? TIME_INPUT_LENGTH : TITLE_LIMIT;
}
function maskedValue(kind: FieldKind, value: string): string {
  if (kind === "date") return maskDateBR(value);
  return kind === "time" ? maskTime24(value) : value;
}
