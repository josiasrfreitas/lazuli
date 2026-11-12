"use client";
import { useState } from "react";
import { Button, ScheduleCalendar, type CalendarEvent } from "@lazuli/ui";
import { ArrowLeft } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { agendaEvents, type CalendarLesson } from "~/features/class-records/calendar-model";
import { CalendarDialogs } from "~/features/class-records/calendar-view";
import { CalendarLessonButton } from "~/features/class-records/calendar-lesson";
import { CalendarLinkedLesson } from "~/features/class-records/calendar-linked-lesson";
import { lessonCalendarEvents } from "~/features/class-records/weekly-calendar";
import type { AcademicYear } from "./model";
import styles from "./workshop.module.css";

type AcademicDayEvent = CalendarEvent & { lesson?: CalendarLesson; academicId?: string };
export function academicDayEvents(date: string, data: AcademicYear): AcademicDayEvent[] {
  const from = new Date(`${date}T00:00:00-03:00`);
  const to = new Date(from.getTime() + 86400000);
  const time = (value: Date) =>
    value.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  return data.events
    .filter((e) => e.startsAt < to && e.endsAt > from)
    .map((e) => ({
      id: `academic-${e.id}`,
      academicId: e.id,
      date,
      title: e.title,
      ...(e.description ? { subtitle: e.description } : {}),
      startTime: e.startsAt < from ? "00:00" : time(e.startsAt),
      endTime: e.endsAt >= to ? "24:00" : time(e.endsAt),
      tone: "info",
    }));
}
export function AcademicDayAgenda({
  date,
  data,
  onDateChange,
  onEditEvent,
  onBack,
  suspension,
}: {
  date: string;
  data: AcademicYear;
  onDateChange: (date: string) => void;
  onEditEvent?: (id: string) => void;
  onBack: () => void;
  suspension?: string | undefined;
}) {
  const sessions = trpc.classRecords.list.useQuery({ from: date, to: date });
  const appointments = trpc.appointments.list.useQuery({ from: date, through: date });
  const experiments = trpc.classRecords.experimentalSessions.useQuery({ from: date, to: date });
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [experimentId, setExperimentId] = useState<string | null>(null);
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
  function open(lesson: CalendarLesson) {
    if (lesson.appointment) setAppointmentId(lesson.appointment.id);
    else if (lesson.experimental) setExperimentId(lesson.experimental.id);
    else setLessonId(lesson.id);
  }
  return (
    <>
      <div className={styles.agendaGrid}>
        <ScheduleCalendar
          date={date}
          view="day"
          minDate="2000-01-01"
          maxDate="2100-12-31"
          onDateChange={onDateChange}
          onViewChange={() => undefined}
          dateLabel={new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          viewControl={
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft />
              Voltar ao mês
            </Button>
          }
          events={events}
          backgroundIntervals={
            suspension
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
              : []
          }
          widthBehavior="scroll"
          status={error ? "error" : pending ? "loading" : "ready"}
          errorMessage="Não foi possível carregar as atividades deste dia."
          onRetry={() => {
            void sessions.refetch();
            void appointments.refetch();
            void experiments.refetch();
          }}
          keepExpanded={Boolean(lessonId || appointmentId || experimentId)}
          onEventActivate={(event) => {
            if (event.lesson) open(event.lesson);
            else if (event.academicId) onEditEvent?.(event.academicId);
          }}
          renderEvent={(event, context) => {
            if (event.lesson?.appointments?.length || event.lesson?.leadGuests?.length)
              return (
                <CalendarLinkedLesson
                  lesson={event.lesson}
                  expanded={context.expanded}
                  appointmentId={appointmentId}
                  onToggle={context.toggleExpanded}
                  onOpen={open}
                  onOpenAppointment={setAppointmentId}
                  onOpenExperimental={setExperimentId}
                  personal={false}
                />
              );
            if (event.lesson)
              return (
                <CalendarLessonButton
                  lesson={event.lesson}
                  onOpen={open}
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
          }}
        />
      </div>
      <CalendarDialogs
        lessons={lessons}
        lessonId={lessonId}
        appointmentId={appointmentId}
        experimentId={experimentId}
        setLessonId={setLessonId}
        setAppointmentId={setAppointmentId}
        setExperimentId={setExperimentId}
        admin
      />
    </>
  );
}
