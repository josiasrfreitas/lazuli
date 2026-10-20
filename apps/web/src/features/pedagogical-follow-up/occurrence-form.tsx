"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  FieldError,
  FormSection,
  ScheduleCalendar,
  type CalendarView,
} from "@lazuli/ui";
import { occurrenceCreateSchema } from "@lazuli/validators";
import {
  CalendarDays,
  Check,
  FileText,
  MessageSquare,
  RefreshCw,
  Tag,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { monday, schoolToday, shiftDate } from "~/features/class-records/calendar-model";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { FormFieldLoading } from "./form-field-loading";
import { occurrenceCalendarHours } from "./occurrence-calendar-hours";
import { OccurrenceLessonCard } from "./occurrence-calendar-event";
import { CATEGORY, dateLabel } from "./shared";
import { studentFollowUpHref } from "./student-navigation";
import styles from "./occurrence-form.module.css";

export function OccurrenceForm({
  onClose,
  student,
  onCreated,
}: {
  onClose: () => void;
  student?: { id: string; name: string };
  onCreated?: (id: string) => void;
}): ReactElement {
  const [date, setDate] = useState(schoolToday);
  const [view, setView] = useState<CalendarView>("day");
  const [values, setValues] = useState({
    classSessionId: "",
    studentId: student?.id ?? "",
    category: "LEARNING",
    title: "",
    account: "",
    initialResponse: "",
  });
  const validation = useValidation();
  const from = view === "week" ? monday(date) : date;
  const sessions = trpc.occurrences.sessions.useQuery({
    ...(student ? { studentId: student.id } : {}),
    range: { from, to: view === "week" ? shiftDate(from, 6) : date },
  });
  const roster = trpc.occurrences.roster.useQuery(
    { id: values.classSessionId },
    { enabled: !student && Boolean(values.classSessionId) },
  );
  const selected = sessions.data?.find((row) => row.id === values.classSessionId);
  const hours = occurrenceCalendarHours(sessions.data ?? []);
  const calendarBusy = sessions.isPending || sessions.isFetching;
  const rosterReady =
    Boolean(student) ||
    Boolean(
      roster.data?.some((row) => row.id === values.studentId) &&
      !roster.isError &&
      !roster.isFetching,
    );
  const canSubmit = Boolean(selected) && !calendarBusy && !sessions.isError && rosterReady;
  const router = useRouter();
  const utils = trpc.useUtils();
  const save = trpc.occurrences.create.useMutation({
    onSuccess: async (result, submitted) => {
      await utils.occurrences.invalidate();
      onClose();
      if (onCreated) onCreated(result.id);
      else
        router.push(
          studentFollowUpHref(submitted.studentId, { kind: "occurrence", id: result.id }),
        );
    },
  });
  const change = (name: keyof typeof values, value: string): void => {
    if (save.isPending) return;
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "classSessionId" ? { studentId: student?.id ?? "" } : {}),
    }));
    validation.clear(name);
    if (name === "classSessionId") validation.clear("studentId");
    save.reset();
  };

  return (
    <TaskDialog
      title="Registrar ocorrência"
      description={student ? student.name : "Escolha a aula e registre o que aconteceu."}
      size="extra-wide"
      contentClassName={styles.dialog}
      compactHeader
      onClose={onClose}
      pending={save.isPending}
      firstField="classSessionId"
      formId="occurrence-form"
      submitLabel="Registrar ocorrência"
      submitDisabled={!canSubmit}
      actionSize="sm"
      submitIcon={<Check aria-hidden="true" className="size-4" />}
      cancelIcon={<X aria-hidden="true" className="size-4" />}
      bodyRef={validation.body}
      error={save.error?.message}
    >
      <form
        id="occurrence-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending || !canSubmit) return;
          const parsed = validation.validate(occurrenceCreateSchema, values);
          if (parsed) save.mutate(parsed);
        }}
      >
        <fieldset disabled={save.isPending} className={styles.layout}>
          <legend className="sr-only">Registro de ocorrência</legend>
          <Field
            name="classSessionId"
            className={styles.schedule}
            aria-labelledby="occurrence-lesson-heading"
          >
            <h3 id="occurrence-lesson-heading" className="sr-only">
              Escolha a aula em andamento ou já realizada
            </h3>
            <div
              id="classSessionId"
              className={styles.calendar}
              tabIndex={0}
              role="group"
              aria-label="Selecionar aula da ocorrência"
              aria-invalid={Boolean(validation.errors.classSessionId)}
              aria-describedby={
                validation.errors.classSessionId ? "occurrence-lesson-error" : undefined
              }
            >
              <ScheduleCalendar
                date={date}
                view={view}
                density="compact"
                expandEvents={false}
                dateLabel={
                  view === "day"
                    ? new Intl.DateTimeFormat("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })
                        .format(new Date(`${date}T12:00:00Z`))
                        .replace(/^./, (letter) => letter.toUpperCase())
                    : new Intl.DateTimeFormat("pt-BR", {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      }).formatRange(
                        new Date(`${from}T12:00:00Z`),
                        new Date(`${shiftDate(from, 6)}T12:00:00Z`),
                      )
                }
                {...(hours ? { hours } : {})}
                events={(sessions.data ?? []).map((row) => ({
                  id: row.id,
                  date: row.date.toISOString().slice(0, 10),
                  startTime: row.startTime.toISOString().slice(11, 16),
                  endTime: row.endTime.toISOString().slice(11, 16),
                  title: row.className,
                  tone: "info" as const,
                  teacherName: row.teacherName,
                  substitute: row.substitute,
                  stageName: row.stageName,
                  scheduleType: row.scheduleType,
                  format: row.format,
                }))}
                renderEvent={(event, context) => (
                  <OccurrenceLessonCard event={event} context={context} />
                )}
                onDateChange={(next) => {
                  if (save.isPending || next === date) return;
                  setDate(next);
                  change("classSessionId", "");
                }}
                onViewChange={(next) => {
                  if (save.isPending || next === view) return;
                  setView(next);
                  change("classSessionId", "");
                }}
                selectedEventId={selected?.id}
                onEventActivate={(event) => change("classSessionId", event.id)}
                status={calendarBusy ? "loading" : sessions.isError ? "error" : "ready"}
                errorMessage="Não foi possível carregar as aulas. Tente novamente."
                onRetry={() => void sessions.refetch()}
                label="Aulas disponíveis para registrar ocorrência"
                emptyMessage="Nenhuma aula disponível neste período. Escolha uma data anterior."
              />
            </div>
            <FieldError
              id="occurrence-lesson-error"
              match={Boolean(validation.errors.classSessionId)}
            >
              {validation.errors.classSessionId}
            </FieldError>
          </Field>
          <div className={styles.fields}>
            <div className={styles.selection} aria-live="polite" aria-atomic="true">
              {selected ? (
                <>
                  <Check aria-hidden="true" className="size-4" />
                  <div>
                    <strong>{selected.className}</strong>
                    <p>
                      {dateLabel(selected.date)} · {selected.startTime.toISOString().slice(11, 16)}–
                      {selected.endTime.toISOString().slice(11, 16)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CalendarDays aria-hidden="true" className="size-4" />
                  <p>Selecione no calendário a aula em que aconteceu.</p>
                </>
              )}
            </div>
            {!student &&
              values.classSessionId &&
              (roster.isPending || roster.isFetching ? (
                <FormFieldLoading label="Alunos da aula" />
              ) : roster.isError ? (
                <div role="alert" className="grid gap-2 text-caption text-destructive">
                  Não foi possível carregar os alunos desta aula.
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void roster.refetch()}
                  >
                    <RefreshCw aria-hidden="true" />
                    Tentar novamente
                  </Button>
                </div>
              ) : roster.data?.length === 0 ? (
                <p className="text-caption text-muted-foreground">
                  Esta aula não tem alunos disponíveis. Escolha outra aula.
                </p>
              ) : (
                <SelectControl
                  name="studentId"
                  label="Aluno"
                  labelIcon={<UserRound aria-hidden="true" className="size-3.5" />}
                  value={values.studentId}
                  onChange={(value) => change("studentId", value)}
                  choices={(roster.data ?? []).map((row) => ({
                    value: row.id,
                    label: row.fullName,
                  }))}
                  error={validation.errors.studentId}
                />
              ))}
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
          </div>
        </fieldset>
      </form>
    </TaskDialog>
  );
}
