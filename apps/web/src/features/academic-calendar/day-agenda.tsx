"use client";
import type { ReactElement } from "react";
import {
  ScheduleCalendar,
  type CalendarEvent,
  type CalendarEventRenderContext,
  type CalendarBackgroundInterval,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import {
  agendaEvents,
  lessonCalendarEvents,
  type CalendarLesson,
} from "~/features/class-records/calendar-model";
import { CalendarDialogs, CalendarDayLesson } from "~/features/class-records/calendar-view";
import {
  useCalendarSelection,
  type CalendarSelection,
} from "~/features/class-records/use-calendar-selection";
import type { AcademicYear } from "./model";
import styles from "./workshop.module.css";

const DAY_MS = 86_400_000;
type AcademicDayEvent = CalendarEvent & { lesson?: CalendarLesson; academicId?: string };
export function academicDayEvents(date: string, data: AcademicYear): AcademicDayEvent[] {
  const from = new Date(`${date}T00:00:00-03:00`);
  const to = new Date(from.getTime() + DAY_MS);
  const time = (value: Date): string =>
    value.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  return data.events
    .filter((event) => event.startsAt < to && event.endsAt > from)
    .map((event) => ({
      id: `academic-${event.id}`,
      academicId: event.id,
      date,
      title: event.title,
      ...(event.description ? { subtitle: event.description } : {}),
      startTime: event.startsAt < from ? "00:00" : time(event.startsAt),
      endTime: event.endsAt >= to ? "24:00" : time(event.endsAt),
      tone: "info",
    }));
}
type DayAgendaProps = {
  date: string;
  data: AcademicYear;
  onDateChange: (date: string) => void;
  onEditEvent?: (id: string) => void;
  suspension?: string | undefined;
};
type DayData = {
  lessons: ReturnType<typeof agendaEvents>;
  events: AcademicDayEvent[];
  pending: boolean;
  error: boolean;
  retry: () => void;
};
export function AcademicDayAgenda(props: DayAgendaProps): ReactElement {
  const data = useDayData(props);
  const dialogs = useCalendarSelection();
  return <DayAgendaView props={props} data={data} dialogs={dialogs} />;
}
function useDayData({ date, data }: DayAgendaProps): DayData {
  const sessions = trpc.classRecords.list.useQuery({ from: date, to: date });
  const appointments = trpc.appointments.list.useQuery({ from: date, through: date });
  const experiments = trpc.classRecords.experimentalSessions.useQuery({ from: date, to: date });
  const lessons = agendaEvents(sessions.data ?? [], {
    appointments: appointments.data ?? [],
    experiments: experiments.data ?? [],
  });
  const events: AcademicDayEvent[] = [
    ...lessonCalendarEvents(lessons),
    ...academicDayEvents(date, data),
  ];
  const pending = sessions.isPending || appointments.isPending || experiments.isPending;
  const error = sessions.error || appointments.error || experiments.error;
  return {
    lessons,
    events,
    pending,
    error: Boolean(error),
    retry: () => {
      void sessions.refetch();
      void appointments.refetch();
      void experiments.refetch();
    },
  };
}
function DayAgendaView({
  props: { date, onDateChange, onEditEvent, suspension },
  data: { lessons, events, pending, error, retry },
  dialogs,
}: {
  props: DayAgendaProps;
  data: DayData;
  dialogs: CalendarSelection;
}): ReactElement {
  return (
    <>
      <div className={styles.agendaGrid}>
        <ScheduleCalendar
          date={date}
          view="day"
          minDate="2000-01-01"
          maxDate="2100-12-31"
          onDateChange={onDateChange}
          onViewChange={() => {}}
          dateLabel={new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          viewControl={<></>}
          events={events}
          backgroundIntervals={suspensionIntervals(date, suspension)}
          widthBehavior="scroll"
          status={agendaStatus({ error, pending })}
          errorMessage="Não foi possível carregar as atividades deste dia."
          onRetry={retry}
          keepExpanded={Boolean(dialogs.target)}
          onEventActivate={(event) => {
            if (event.lesson) dialogs.openLesson(event.lesson);
            else if (event.academicId) onEditEvent?.(event.academicId);
          }}
          renderEvent={(event, context) => renderDayEvent({ event, context, dialogs })}
        />
      </div>
      <CalendarDialogs
        lessons={lessons}
        target={dialogs.target}
        setTarget={dialogs.setTarget}
        admin
      />
    </>
  );
}

function renderDayEvent({
  event,
  context,
  dialogs,
}: {
  event: AcademicDayEvent;
  context: CalendarEventRenderContext;
  dialogs: CalendarSelection;
}): ReactElement {
  if (event.lesson)
    return (
      <CalendarDayLesson
        lesson={event.lesson}
        context={context}
        selection={dialogs}
        expanded={context.expanded}
      />
    );
  return (
    <button
      type="button"
      className={styles.academicEvent}
      onClick={context.activate}
      aria-label={`${event.title} · ${event.startTime}–${event.endTime}`}
    >
      <span>
        {event.startTime}–{event.endTime}
      </span>
      <strong>{event.title}</strong>
      {event.subtitle && <span>{event.subtitle}</span>}
    </button>
  );
}
function suspensionIntervals(
  date: string,
  suspension: string | undefined,
): CalendarBackgroundInterval[] {
  return suspension
    ? [
        {
          id: `suspension-${date}`,
          date,
          startTime: "00:00",
          endTime: "24:00",
          label: `${suspension} · Dia inteiro sem atividades acadêmicas`,
          tone: "warning",
        },
      ]
    : [];
}
function agendaStatus({
  error,
  pending,
}: Pick<DayData, "error" | "pending">): "error" | "loading" | "ready" {
  if (error) return "error";
  return pending ? "loading" : "ready";
}
