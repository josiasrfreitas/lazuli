"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { parseAsString, useQueryState } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Plus } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  ScheduleCalendar,
  getScheduleCalendarRange,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { schoolToday } from "~/features/class-records/calendar-model";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { purposes } from "~/features/appointments/shared";
import { StudentAgendaScheduling } from "./student-agenda-scheduling";
import type { StudentProfile } from "./logic";
import styles from "./student-agenda.module.css";

type Agenda = RouterOutputs["students"]["agenda"];
type Appointment = RouterOutputs["appointments"]["detail"]["snapshot"];
type Scheduling = { initialSelection?: CalendarInterval; previous?: Appointment };
type StudentEvent = CalendarEvent & {
  kind: "regular" | "personalized" | "appointment";
  recordId: string;
  statusLabel: string;
  cancelled: boolean;
  lesson?: Agenda["lessons"][number];
};

export function StudentAgendaDialog({
  profile,
  canSchedule,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
}): ReactElement {
  const [appointmentId, setAppointmentId] = useQueryState("atendimento", parseAsString);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState(schoolToday);
  const [view, setView] = useState<CalendarView>("week");
  const [scheduling, setScheduling] = useState<Scheduling | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [projectedLesson, setProjectedLesson] = useState<Agenda["lessons"][number] | null>(null);
  const utils = trpc.useUtils();
  const range = getScheduleCalendarRange({ date, view });
  const query = trpc.students.agenda.useQuery(
    { id: profile.id, from: range.from, to: range.through },
    { enabled: open },
  );
  const appointment = trpc.appointments.detail.useQuery(
    { id: appointmentId ?? "" },
    { enabled: open && Boolean(appointmentId), retry: false },
  );
  const snapshot = appointment.data?.snapshot;
  const wrongStudent = Boolean(snapshot && snapshot.student.id !== profile.id);
  const detailId = projectedLesson?.id ?? lessonId ?? (!wrongStudent ? appointmentId : null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!detailId || !open) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [detailId, open]);
  useEffect(() => {
    if (appointmentId) setOpen(true);
  }, [appointmentId]);
  useEffect(() => {
    if (snapshot && !wrongStudent) setDate(snapshot.date);
  }, [snapshot?.id, snapshot?.date, wrongStudent]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    const adaptView = (): void => {
      if (mobile.matches) setView("day");
    };
    adaptView();
    mobile.addEventListener("change", adaptView);
    return () => mobile.removeEventListener("change", adaptView);
  }, []);
  const returnToAgenda = useCallback(() => {
    setScheduling(null);
    setLessonId(null);
    setProjectedLesson(null);
    void setAppointmentId(null);
    void utils.students.agenda.invalidate({ id: profile.id });
    void utils.students.health.invalidate({ id: profile.id });
    requestAnimationFrame(() => document.getElementById("student-agenda-new")?.focus());
  }, [profile.id, setAppointmentId, utils]);
  const calendar = (
    <StudentAgendaCalendar
      date={date}
      view={view}
      onDateChange={setDate}
      onViewChange={setView}
      data={query.data}
      status={query.isError ? "error" : query.isPending ? "loading" : "ready"}
      onRetry={() => void query.refetch()}
      onCreate={
        canSchedule && !scheduling
          ? (selection) => setScheduling(selection ? { initialSelection: selection } : {})
          : undefined
      }
      onEvent={
        scheduling
          ? undefined
          : (event) => {
              if (event.kind === "appointment") void setAppointmentId(event.recordId);
              else if (event.lesson?.sessionId) setLessonId(event.lesson.sessionId);
              else if (event.lesson) setProjectedLesson(event.lesson);
            }
      }
    />
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (pending) {
          event.cancel();
          return;
        }
        setOpen(next);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) returnToAgenda();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <CalendarDays aria-hidden="true" /> Agenda do aluno
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={detailId ? styles.detailsDialog : styles.dialog}
          data-student-dialog-motion
          showCloseButton={!pending}
        >
          <div ref={panel} key={detailId ?? "agenda"} className={styles.panel}>
            {projectedLesson ? (
              <ProjectedLessonDetails lesson={projectedLesson} onBack={returnToAgenda} />
            ) : lessonId ? (
              <ClassRecordDialog embedded id={lessonId} onClose={returnToAgenda} />
            ) : appointmentId && !wrongStudent ? (
              <StudentAppointmentDialog
                embedded
                key={appointmentId}
                id={appointmentId}
                admin
                readOnly={!canSchedule}
                onClose={returnToAgenda}
                onSelect={(id) => {
                  void setAppointmentId(id);
                }}
                onPendingChange={setPending}
                onOpenLesson={(id) => {
                  void setAppointmentId(null);
                  setLessonId(id);
                }}
                onReschedule={(previous) => {
                  void setAppointmentId(null);
                  setScheduling({ previous });
                }}
              />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Agenda do aluno</DialogTitle>
                  <DialogDescription>
                    {profile.contact.fullName} · Aulas e atendimentos
                  </DialogDescription>
                </DialogHeader>
                {wrongStudent && (
                  <Alert variant="warning">Este atendimento pertence a outro aluno.</Alert>
                )}
                {scheduling ? (
                  <StudentAgendaScheduling
                    calendar={calendar}
                    student={{ id: profile.id, name: profile.contact.fullName }}
                    initialDate={date < schoolToday() ? schoolToday() : date}
                    initialSelection={scheduling.initialSelection}
                    {...(scheduling.previous ? { previous: scheduling.previous } : {})}
                    onPendingChange={setPending}
                    onClose={returnToAgenda}
                  />
                ) : (
                  <>
                    <div className={styles.calendar}>{calendar}</div>
                    <div className={styles.legend} aria-label="Tipos de compromisso">
                      <span data-kind="regular">Aula regular</span>
                      <span data-kind="personalized">Aula PPT</span>
                      <span data-kind="appointment">Atendimento</span>
                      {!canSchedule && (
                        <p>Novos atendimentos ficam disponíveis com uma matrícula vigente.</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function StudentAgendaCalendar({
  date,
  view,
  onDateChange,
  onViewChange,
  data,
  status,
  onRetry,
  onCreate,
  onEvent,
}: {
  date: string;
  view: CalendarView;
  onDateChange: (value: string) => void;
  onViewChange: (value: CalendarView) => void;
  data: Agenda | undefined;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  onCreate: ((selection?: CalendarInterval) => void) | undefined;
  onEvent: ((event: StudentEvent) => void) | undefined;
}): ReactElement {
  const events = studentAgendaEvents(data);
  return (
    <ScheduleCalendar
      date={date}
      view={view}
      onDateChange={onDateChange}
      onViewChange={onViewChange}
      events={events}
      density="compact"
      widthBehavior="scroll"
      timeZone="America/Sao_Paulo"
      label="Compromissos do aluno"
      emptyMessage="Nenhuma aula ou atendimento neste período."
      status={status}
      errorMessage="Não foi possível carregar a agenda do aluno."
      onRetry={onRetry}
      {...(onEvent ? { onEventActivate: onEvent } : {})}
      rangeSelection={
        onCreate
          ? {
              clickDurationMinutes: 60,
              minimum: {
                date: schoolToday(),
                time: new Intl.DateTimeFormat("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }).format(new Date()),
              },
              blocked: events
                .filter((event) => !event.cancelled)
                .map((event) => ({ ...event, label: event.title })),
              onSelect: onCreate,
              controls: <></>,
            }
          : undefined
      }
      actions={
        onCreate ? (
          <Button id="student-agenda-new" size="sm" onClick={() => onCreate()}>
            <Plus aria-hidden="true" /> Novo atendimento
          </Button>
        ) : undefined
      }
      renderEvent={(event, context) => (
        <button
          type="button"
          id={event.kind === "appointment" ? "appointment-cell-" + event.recordId : undefined}
          className={styles.event}
          data-kind={event.kind}
          data-cancelled={event.cancelled || undefined}
          data-expanded={context.expanded || undefined}
          disabled={context.disabled || !onEvent}
          onClick={context.activate}
          aria-label={
            event.title +
            ", " +
            event.date +
            ", " +
            event.startTime +
            " às " +
            event.endTime +
            ". " +
            event.subtitle +
            ". " +
            event.statusLabel
          }
        >
          <strong>{event.title}</strong>
          <span className={styles.eventTime}>
            {event.startTime}–{event.endTime}
          </span>
          <span>{event.subtitle}</span>
          <span className={styles.eventStatus}>{event.statusLabel}</span>
        </button>
      )}
    />
  );
}

function ProjectedLessonDetails({
  lesson,
  onBack,
}: {
  lesson: Agenda["lessons"][number];
  onBack: () => void;
}): ReactElement {
  return (
    <>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Voltar à agenda
        </Button>
      </div>
      <DialogHeader>
        <DialogTitle>{lesson.className}</DialogTitle>
        <DialogDescription>
          {formatDateOnlyBR(lesson.date)} · {lesson.startTime}–{lesson.endTime}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-5 text-sm">
        <p>
          {lesson.teacher ?? "Professor a definir"} ·{" "}
          {lesson.format === "ONLINE" ? "Online" : "Presencial"}
        </p>
        <p className="text-muted-foreground">
          Encontro previsto no horário da turma. O registro da aula ainda não está disponível.
        </p>
        <Button
          variant="link"
          size="sm"
          nativeButton={false}
          render={<Link href={"/turmas/" + lesson.classId} />}
        >
          Ver turma <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

function studentAgendaEvents(data: Agenda | undefined): StudentEvent[] {
  if (!data) return [];
  const lessons: StudentEvent[] = data.lessons.map((lesson) => ({
    id: `lesson-${lesson.id}`,
    recordId: lesson.id,
    lesson,
    kind: lesson.scheduleType === "PERSONALIZED" ? "personalized" : "regular",
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    title: lesson.scheduleType === "PERSONALIZED" ? `PPT · ${lesson.className}` : lesson.className,
    subtitle: lesson.teacher ?? "Professor a definir",
    statusLabel:
      lesson.state === "CANCELLED"
        ? "Cancelada"
        : lesson.state === "UPCOMING"
          ? "Agendada"
          : !lesson.sessionId
            ? "Prevista no horário da turma"
            : lesson.state === "PENDING"
              ? "Aguardando registro"
              : "Aula realizada",
    cancelled: lesson.state === "CANCELLED",
  }));
  const appointments: StudentEvent[] = data.appointments.map((appointment) => ({
    id: `appointment-${appointment.id}`,
    recordId: appointment.id,
    kind: "appointment",
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    title: purposes[appointment.purpose],
    subtitle: appointment.teacher?.name ?? "Professor a definir",
    statusLabel:
      appointment.status === "CANCELLED"
        ? appointment.rescheduledToId
          ? "Reagendado"
          : "Cancelado"
        : appointment.status === "ATTENDED"
          ? "Realizado"
          : appointment.status === "NO_SHOW"
            ? "Não compareceu"
            : appointment.overdue
              ? "Aguardando registro"
              : "Agendado",
    cancelled: appointment.status === "CANCELLED",
  }));
  return [...lessons, ...appointments];
}
