import type { FormEvent } from "react";
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
const date = z.string().refine((value) => Boolean(parseDateBR(value)), "Informe uma data válida.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário entre 00:00 e 23:59.");
export const eventDraftSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título do evento.").max(160),
    description: z.string().trim().max(2000),
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

export function AcademicEventFields({
  values,
  errors,
  pending,
  change,
  submit,
}: {
  values: EventDraft;
  errors: Record<string, string>;
  pending: boolean;
  change: (name: keyof EventDraft, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function field(
    name: keyof EventDraft,
    label: string,
    placeholder: string,
    kind: "date" | "time" | "text" = "text",
  ) {
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
          maxLength={kind === "date" ? 10 : kind === "time" ? 5 : 160}
          onChange={(event) =>
            change(
              name,
              kind === "date"
                ? maskDateBR(event.target.value)
                : kind === "time"
                  ? maskTime24(event.target.value)
                  : event.target.value,
            )
          }
        />
        <FieldError id={`event-${name}-error`} match={Boolean(error)}>
          {error}
        </FieldError>
      </Field>
    );
  }
  return (
    <form id="academic-event" noValidate onSubmit={submit} className="grid gap-4">
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {field("title", "Título", "Ex.: Encontro cultural")}
        <FormSection title="Horários de São Paulo">
          <FormRow columns={2} className="grid-cols-2">
            {field("startDate", "Data de início", "dd/mm/aaaa", "date")}
            {field("startTime", "Hora de início", "hh:mm", "time")}
          </FormRow>
          <FormRow columns={2} className="grid-cols-2">
            {field("endDate", "Data de fim", "dd/mm/aaaa", "date")}
            {field("endTime", "Hora de fim", "hh:mm", "time")}
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
            maxLength={2000}
            onChange={(event) => change("description", event.target.value)}
          />
        </Field>
      </fieldset>
    </form>
  );
}
