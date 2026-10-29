import type { ReactElement } from "react";
import { Button, FormSection } from "@lazuli/ui";
import {
  CalendarDays,
  Check,
  FileText,
  MessageSquare,
  RefreshCw,
  Tag,
  UserRound,
  Zap,
} from "lucide-react";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { NarrativeField } from "~/features/shared/task-form";
import { FormFieldLoading } from "./form-field-loading";
import { CATEGORY, dateLabel } from "./shared";
import type { OccurrenceFormModel } from "./occurrence-form-model";
import styles from "./occurrence-form.module.css";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

export function OccurrenceFields({ model }: { model: OccurrenceFormModel }): ReactElement {
  return (
    <div className={styles.fields}>
      <SelectedLesson model={model} />
      <RosterField model={model} />
      <OccurrenceNarrative model={model} />
      <InitialResponse model={model} />
    </div>
  );
}

function SelectedLesson({ model }: { model: OccurrenceFormModel }): ReactElement {
  const { selected } = model;
  return (
    <div className={styles.selection} aria-live="polite" aria-atomic="true">
      {selected ? (
        <>
          <Check aria-hidden="true" className="size-4" />
          <div>
            <strong>{selected.className}</strong>
            <p>
              {dateLabel(selected.date)} ·{" "}
              {selected.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX)}–
              {selected.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX)}
            </p>
          </div>
        </>
      ) : (
        <>
          <CalendarDays aria-hidden="true" className="size-4" />
          <p>
            Selecione {model.mobileList ? "na lista" : "no calendário"} a aula em que aconteceu.
          </p>
        </>
      )}
    </div>
  );
}

function RosterField({ model }: { model: OccurrenceFormModel }): ReactElement | null {
  const { student, values, roster, validation, change } = model;
  if (student || !values.classSessionId) return null;
  if (roster.isPending || roster.isFetching) return <FormFieldLoading label="Alunos da aula" />;
  if (roster.isError) return <RosterError retry={() => void roster.refetch()} />;
  if (roster.data?.length === 0)
    return (
      <p className="text-caption text-muted-foreground">
        Esta aula não tem alunos disponíveis. Escolha outra aula.
      </p>
    );
  return (
    <SelectControl
      name="studentId"
      label="Aluno"
      labelIcon={<UserRound aria-hidden="true" className="size-3.5" />}
      value={values.studentId}
      onChange={(value) => change("studentId", value)}
      choices={(roster.data ?? []).map((row) => ({ value: row.id, label: row.fullName }))}
      error={validation.errors.studentId}
    />
  );
}

function RosterError({ retry }: { retry: () => void }): ReactElement {
  return (
    <div role="alert" className="grid gap-2 text-caption text-destructive">
      Não foi possível carregar os alunos desta aula.
      <Button type="button" size="sm" variant="secondary" onClick={retry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  );
}

function OccurrenceNarrative({ model }: { model: OccurrenceFormModel }): ReactElement {
  const { values, validation, change } = model;
  return (
    <FormSection title="Relato">
      <TextControl
        name="title"
        label="Título"
        labelIcon={<FileText aria-hidden="true" className="size-3.5" />}
        value={values.title}
        onChange={(value) => change("title", value)}
        placeholder="Ex.: Dificuldade na atividade de listening"
        error={validation.errors.title}
      />
      <SelectControl
        name="category"
        label="Contexto"
        labelIcon={<Tag aria-hidden="true" className="size-3.5" />}
        value={values.category}
        onChange={(value) => change("category", value)}
        choices={Object.entries(CATEGORY).map(([value, label]) => ({ value, label }))}
        error={validation.errors.category}
      />
      <NarrativeField
        name="account"
        label="O que aconteceu?"
        labelIcon={<MessageSquare aria-hidden="true" className="size-3.5" />}
        value={values.account}
        onChange={(value) => change("account", value)}
        placeholder="Descreva os fatos observados e o contexto da atividade."
        error={validation.errors.account}
        rows={5}
      />
    </FormSection>
  );
}

function InitialResponse({ model }: { model: OccurrenceFormModel }): ReactElement {
  const { values, validation, change } = model;
  return (
    <NarrativeField
      name="initialResponse"
      label="Ação imediata (opcional)"
      labelIcon={<Zap aria-hidden="true" className="size-3.5" />}
      value={values.initialResponse}
      onChange={(value) => change("initialResponse", value)}
      placeholder="Ex.: Retomei a instrução com um exemplo e combinei uma revisão."
      error={validation.errors.initialResponse}
      rows={2}
    />
  );
}
