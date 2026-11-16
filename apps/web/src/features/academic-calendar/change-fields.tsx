import styles from "./configuration.module.css";
import type { FormEvent, ReactElement } from "react";
import { z } from "@lazuli/validators";
import {
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { maskDateBR, parseDateBR } from "~/lib/masks";
const kinds = [
  { value: "HOLIDAY", label: "Feriado" },
  { value: "RECESS", label: "Recesso" },
  { value: "MAINTENANCE", label: "Manutenção" },
  { value: "OTHER", label: "Outro" },
] as const;
const TITLE_LIMIT = 160;
const PERIOD_TITLE_LIMIT = 80;
const DESCRIPTION_LIMIT = 2000;
const DATE_LENGTH = 10;
const date = z.string().refine((value) => Boolean(parseDateBR(value)), "Informe uma data válida.");
export const draftSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um nome.").max(TITLE_LIMIT),
    from: date,
    through: date,
    description: z.string().max(DESCRIPTION_LIMIT),
    kind: z.enum(["HOLIDAY", "RECESS", "MAINTENANCE", "OTHER"]),
  })
  .refine(
    (value) =>
      !parseDateBR(value.from) ||
      !parseDateBR(value.through) ||
      parseDateBR(value.through)! >= parseDateBR(value.from)!,
    { path: ["through"], message: "O fim deve ser igual ou posterior ao início." },
  );

export type CalendarDraft = z.infer<typeof draftSchema>;
type ChangeFieldsProps = {
  mode: "period" | "interruption";
  draft: CalendarDraft;
  errors: Record<string, string>;
  pending: boolean;
  update: (key: keyof CalendarDraft, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
export function CalendarChangeFields({
  mode,
  draft,
  errors,
  pending,
  update,
  submit,
}: ChangeFieldsProps): ReactElement {
  const field = (key: "title" | "from" | "through", label: string): ReactElement =>
    changeField({ key, label }, { mode, draft, errors, update });
  return (
    <form id="calendar-change" noValidate className="grid gap-4 pt-5" onSubmit={submit}>
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        <div className={styles.dateFields}>
          {field("title", mode === "period" ? "Nome do semestre" : "Título")}
          {field("from", "Início")}
          {field("through", "Fim (inclusive)")}
        </div>
        {mode === "interruption" && (
          <Field>
            <Label>Motivo</Label>
            <SegmentedControl
              size="sm"
              wrap
              aria-label="Motivo do recesso"
              value={draft.kind}
              onValueChange={(value) => {
                if (value) update("kind", value);
              }}
            >
              {kinds.map((kind) => (
                <SegmentedControlItem key={kind.value} value={kind.value}>
                  {kind.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Field>
        )}
        {mode === "interruption" && (
          <Field>
            <Label htmlFor="calendar-description">Descrição (opcional)</Label>
            <Textarea
              id="calendar-description"
              name="description"
              autoComplete="off"
              rows={2}
              size="sm"
              value={draft.description}
              maxLength={DESCRIPTION_LIMIT}
              placeholder="Informações úteis sobre este período sem atividades"
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
        )}
        {mode === "interruption" && (
          <p className="text-caption text-muted-foreground">
            Inclui aulas, atendimentos e aulas experimentais. Não altera o funcionamento
            administrativo da escola.
          </p>
        )}
      </fieldset>
    </form>
  );
}

function changeField(
  { key, label }: { key: "title" | "from" | "through"; label: string },
  { mode, draft, errors, update }: Pick<ChangeFieldsProps, "mode" | "draft" | "errors" | "update">,
): ReactElement {
  const error = errors[key];
  return (
    <Field name={key} invalid={Boolean(error)}>
      <Label htmlFor={`calendar-${key}`}>{label}</Label>
      <Input
        id={`calendar-${key}`}
        name={key}
        size="sm"
        autoComplete="off"
        value={draft[key]}
        invalid={Boolean(error)}
        aria-describedby={error ? `calendar-${key}-error` : undefined}
        inputMode={key === "title" ? "text" : "numeric"}
        maxLength={
          key === "title" ? (mode === "period" ? PERIOD_TITLE_LIMIT : TITLE_LIMIT) : DATE_LENGTH
        }
        placeholder={fieldPlaceholder(key, mode)}
        onChange={(event) =>
          update(key, key === "title" ? event.target.value : maskDateBR(event.target.value))
        }
      />
      <FieldError id={`calendar-${key}-error`} match={Boolean(error)}>
        {error}
      </FieldError>
    </Field>
  );
}
function fieldPlaceholder(key: string, mode: ChangeFieldsProps["mode"]): string {
  if (key !== "title") return "dd/mm/aaaa";
  return mode === "period" ? "Ex.: 1º semestre de 2027" : "Ex.: Recesso de carnaval";
}
