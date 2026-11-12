import type { ReactElement } from "react";
import { Field, FieldError, ScheduleCalendar } from "@lazuli/ui";
import { shiftDate } from "~/features/class-records/calendar-model";
import { OccurrenceLessonCard, type OccurrenceCalendarEvent } from "./occurrence-calendar-event";
import type { OccurrenceFormModel } from "./occurrence-form-model";
import { OccurrenceLessonList } from "./occurrence-lesson-list";
import { OccurrenceViewControl, OutsideOccurrenceFields } from "./occurrence-outside-fields";
import styles from "./occurrence-form.module.css";

const WEEK_END_OFFSET = 6;
const ISO_DATE_LENGTH = 10;
const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

export function OccurrenceCalendar({ model }: { model: OccurrenceFormModel }): ReactElement {
  if (model.outside) return <OutsideOccurrenceFields model={model} />;
  const error = model.validation.errors.classSessionId;
  return (
    <div className={styles.schedule} data-mobile-list={model.mobileList}>
      {model.mobileList && model.student && <OccurrenceViewControl model={model} />}
      <Field
        name="classSessionId"
        className="flex min-h-0 flex-1 flex-col gap-3"
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "occurrence-lesson-error" : undefined}
        >
          {model.mobileList ? (
            <OccurrenceLessonList model={model} />
          ) : (
            <OccurrenceSchedule model={model} />
          )}
        </div>
        <FieldError id="occurrence-lesson-error" match={Boolean(error)}>
          {error}
        </FieldError>
      </Field>
    </div>
  );
}

function OccurrenceSchedule({ model }: { model: OccurrenceFormModel }): ReactElement {
  const {
    date,
    view,
    from,
    hours,
    sessions,
    calendarBusy,
    save,
    selected,
    setDate,
    setView,
    change,
  } = model;
  return (
    <ScheduleCalendar
      viewControl={model.student ? <OccurrenceViewControl model={model} /> : undefined}
      date={date}
      view={view}
      density="compact"
      expandEvents={false}
      dateLabel={calendarDateLabel({ date, view, from })}
      {...(hours ? { hours } : {})}
      events={calendarEvents(sessions.data ?? [])}
      renderEvent={(event, context) => <OccurrenceLessonCard event={event} context={context} />}
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
      status={calendarStatus(calendarBusy, sessions.isError)}
      errorMessage="Não foi possível carregar as aulas. Tente novamente."
      onRetry={() => void sessions.refetch()}
      label="Aulas disponíveis para registrar ocorrência"
      emptyMessage="Nenhuma aula disponível neste período. Escolha uma data anterior."
    />
  );
}

function calendarStatus(busy: boolean, error: boolean): "loading" | "error" | "ready" {
  if (busy) return "loading";
  if (error) return "error";
  return "ready";
}

function calendarDateLabel({
  date,
  view,
  from,
}: Pick<OccurrenceFormModel, "date" | "view" | "from">): string {
  if (view === "day")
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    })
      .format(new Date(`${date}T12:00:00Z`))
      .replace(/^./, (letter) => letter.toUpperCase());
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatRange(
    new Date(`${from}T12:00:00Z`),
    new Date(`${shiftDate(from, WEEK_END_OFFSET)}T12:00:00Z`),
  );
}

function calendarEvents(
  rows: NonNullable<OccurrenceFormModel["sessions"]["data"]>,
): OccurrenceCalendarEvent[] {
  return rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString().slice(0, ISO_DATE_LENGTH),
    startTime: row.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: row.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    title: row.className,
    tone: "info" as const,
    teacherName: row.teacherName,
    substitute: row.substitute,
    stageName: row.stageName,
    scheduleType: row.scheduleType,
    format: row.format,
  }));
}
