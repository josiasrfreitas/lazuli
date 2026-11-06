"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import { parseAsString, useQueryState } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Plus } from "lucide-react";
import {
  ToastAlert,
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
  type CalendarEventRenderContext,
  type CalendarInterval,
  type CalendarRangeSelection,
  type CalendarView,
} from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
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
const TEACHER_UNASSIGNED = "Professor a definir";

type AgendaController = {
  appointmentId: string | null;
  setAppointmentId: (value: string | null) => Promise<URLSearchParams>;
  open: boolean;
  setOpen: (value: boolean) => void;
  pending: boolean;
  setPending: (value: boolean) => void;
  date: string;
  setDate: (value: string) => void;
  view: CalendarView;
  setView: (value: CalendarView) => void;
  scheduling: Scheduling | null;
  setScheduling: (value: Scheduling | null) => void;
  lessonId: string | null;
  setLessonId: (value: string | null) => void;
  projectedLesson: Agenda["lessons"][number] | null;
  setProjectedLesson: (value: Agenda["lessons"][number] | null) => void;
  query: QueryResult<Agenda>;
  wrongStudent: boolean;
  detailId: string | null;
  panel: RefObject<HTMLDivElement | null>;
  returnToAgenda: () => void;
};

export function StudentAgendaDialog({
  profile,
  canSchedule,
  secondary = false,
  initialOpen = false,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
  secondary?: boolean;
  initialOpen?: boolean;
}): ReactElement {
  const controller = useAgendaController(profile, initialOpen);
  return (
    <AgendaDialogView
      profile={profile}
      canSchedule={canSchedule}
      controller={controller}
      secondary={secondary}
    />
  );
}

function useAgendaController(profile: StudentProfile, initialOpen: boolean): AgendaController {
  const [appointmentId, setAppointmentId] = useQueryState("atendimento", parseAsString);
  const [open, setOpen] = useState(initialOpen);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState(schoolToday);
  const [view, setView] = useState<CalendarView>("week");
  const [scheduling, setScheduling] = useState<Scheduling | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [projectedLesson, setProjectedLesson] = useState<Agenda["lessons"][number] | null>(null);
  const { query, snapshot } = useAgendaQueries(profile.id, { date, view, open, appointmentId });
  const wrongStudent = Boolean(snapshot && snapshot.student.id !== profile.id);
  const detailId = projectedLesson?.id ?? lessonId ?? (wrongStudent ? null : appointmentId);
  const panel = useRef<HTMLDivElement>(null);
  useAgendaEffects(
    { detailId, open, panel, appointmentId, snapshot, wrongStudent },
    { setOpen, setDate, setView },
  );
  const returnToAgenda = useReturnToAgenda(profile.id, {
    setScheduling,
    setLessonId,
    setProjectedLesson,
    setAppointmentId,
  });
  return {
    appointmentId,
    setAppointmentId,
    open,
    setOpen,
    pending,
    setPending,
    date,
    setDate,
    view,
    setView,
    scheduling,
    setScheduling,
    lessonId,
    setLessonId,
    projectedLesson,
    setProjectedLesson,
    query,
    wrongStudent,
    detailId,
    panel,
    returnToAgenda,
  };
}

function useAgendaQueries(
  studentId: string,
  {
    date,
    view,
    open,
    appointmentId,
  }: Pick<AgendaController, "date" | "view" | "open" | "appointmentId">,
): { query: QueryResult<Agenda>; snapshot: Appointment | undefined } {
  const range = getScheduleCalendarRange({ date, view });
  const query = trpc.students.agenda.useQuery(
    { id: studentId, from: range.from, to: range.through },
    { enabled: open },
  );
  const appointment = trpc.appointments.detail.useQuery(
    { id: appointmentId ?? "" },
    { enabled: open && Boolean(appointmentId), retry: false },
  );
  return { query, snapshot: appointment.data?.snapshot };
}

function useReturnToAgenda(
  studentId: string,
  {
    setScheduling,
    setLessonId,
    setProjectedLesson,
    setAppointmentId,
  }: Pick<
    AgendaController,
    "setScheduling" | "setLessonId" | "setProjectedLesson" | "setAppointmentId"
  >,
): () => void {
  const utils = trpc.useUtils();
  return useCallback(() => {
    setScheduling(null);
    setLessonId(null);
    setProjectedLesson(null);
    void setAppointmentId(null);
    void utils.students.agenda.invalidate({ id: studentId });
    void utils.students.health.invalidate({ id: studentId });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("#student-agenda-new")?.focus(),
    );
  }, [studentId, setAppointmentId, setLessonId, setProjectedLesson, setScheduling, utils]);
}

type AgendaEffects = Pick<
  AgendaController,
  "detailId" | "open" | "panel" | "appointmentId" | "wrongStudent"
> & {
  snapshot: Appointment | undefined;
};

function useAgendaEffects(
  { detailId, open, panel, appointmentId, snapshot, wrongStudent }: AgendaEffects,
  { setOpen, setDate, setView }: Pick<AgendaController, "setOpen" | "setDate" | "setView">,
): void {
  useEffect(() => {
    if (!detailId || !open) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [detailId, open, panel]);
  useEffect(() => {
    if (appointmentId) setOpen(true);
  }, [appointmentId, setOpen]);
  useEffect(() => {
    if (snapshot && !wrongStudent) setDate(snapshot.date);
  }, [snapshot?.id, snapshot?.date, wrongStudent, setDate]);
  useEffect(() => {
    const mobile = globalThis.matchMedia("(max-width: 640px)");
    const adaptView = (): void => {
      if (mobile.matches) setView("day");
    };
    adaptView();
    mobile.addEventListener("change", adaptView);
    return () => mobile.removeEventListener("change", adaptView);
  }, [setView]);
}

function AgendaDialogView({
  profile,
  canSchedule,
  controller,
  secondary,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
  controller: AgendaController;
  secondary: boolean;
}): ReactElement {
  const { open, setOpen, pending, detailId, panel, returnToAgenda } = controller;
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
      <DialogTrigger render={<Button size="sm" variant={secondary ? "secondary" : "primary"} />}>
        <CalendarDays aria-hidden="true" /> Agenda
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          data-student-agenda
          data-details={detailId ? "true" : undefined}
          data-student-dialog-motion
          showCloseButton={!pending}
        >
          <div ref={panel} key={detailId ?? "agenda"} className={styles.panel}>
            <AgendaPanel profile={profile} canSchedule={canSchedule} controller={controller} />
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function AgendaPanel({
  profile,
  canSchedule,
  controller,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
  controller: AgendaController;
}): ReactElement {
  const { projectedLesson, lessonId, appointmentId, wrongStudent, returnToAgenda } = controller;
  if (projectedLesson)
    return <ProjectedLessonDetails lesson={projectedLesson} onBack={returnToAgenda} />;
  if (lessonId) return <ClassRecordDialog embedded id={lessonId} onClose={returnToAgenda} />;
  if (appointmentId && !wrongStudent) {
    return (
      <AppointmentDetails
        appointmentId={appointmentId}
        canSchedule={canSchedule}
        controller={controller}
      />
    );
  }
  return <AgendaLanding profile={profile} canSchedule={canSchedule} controller={controller} />;
}

function AppointmentDetails({
  appointmentId,
  canSchedule,
  controller,
}: {
  appointmentId: string;
  canSchedule: boolean;
  controller: AgendaController;
}): ReactElement {
  const { setAppointmentId, setLessonId, setScheduling, setPending, returnToAgenda } = controller;
  return (
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
  );
}

function AgendaLanding({
  profile,
  canSchedule,
  controller,
}: {
  profile: StudentProfile;
  canSchedule: boolean;
  controller: AgendaController;
}): ReactElement {
  const { wrongStudent, scheduling, date, setPending, returnToAgenda } = controller;
  const calendar = <AgendaCalendarView canSchedule={canSchedule} controller={controller} />;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Agenda do aluno</DialogTitle>
        <DialogDescription>{profile.contact.fullName} · Aulas e atendimentos</DialogDescription>
      </DialogHeader>
      {wrongStudent && (
        <ToastAlert variant="warning">Este atendimento pertence a outro aluno.</ToastAlert>
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
        <AgendaCalendarDefault calendar={calendar} canSchedule={canSchedule} />
      )}
    </>
  );
}

function AgendaCalendarDefault({
  calendar,
  canSchedule,
}: {
  calendar: ReactElement;
  canSchedule: boolean;
}): ReactElement {
  return (
    <>
      <div className={styles.calendar}>{calendar}</div>
      <div className={styles.legend} aria-label="Tipos de compromisso">
        <span data-kind="regular">Aula regular</span>
        <span data-kind="personalized">Aula PPT</span>
        <span data-kind="appointment">Atendimento</span>
        {!canSchedule && <p>Novos atendimentos ficam disponíveis com uma matrícula vigente.</p>}
      </div>
    </>
  );
}

function AgendaCalendarView({
  canSchedule,
  controller,
}: {
  canSchedule: boolean;
  controller: AgendaController;
}): ReactElement {
  const {
    date,
    view,
    setDate,
    setView,
    query,
    scheduling,
    setScheduling,
    setAppointmentId,
    setLessonId,
    setProjectedLesson,
  } = controller;
  const onCreate =
    canSchedule && !scheduling
      ? (selection?: CalendarInterval): void =>
          setScheduling(selection ? { initialSelection: selection } : {})
      : undefined;
  const onEvent = scheduling
    ? undefined
    : (event: StudentEvent): void => {
        if (event.kind === "appointment") void setAppointmentId(event.recordId);
        else if (event.lesson?.sessionId) setLessonId(event.lesson.sessionId);
        else if (event.lesson) setProjectedLesson(event.lesson);
      };
  return (
    <StudentAgendaCalendar
      date={date}
      view={view}
      onDateChange={setDate}
      onViewChange={setView}
      data={query.data}
      status={agendaStatus(query.isError, query.isPending)}
      onRetry={() => void query.refetch()}
      onCreate={onCreate}
      onEvent={onEvent}
    />
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
      expandedEventWidth={320}
      timeZone="America/Sao_Paulo"
      label="Compromissos do aluno"
      emptyMessage="Nenhuma aula ou atendimento neste período."
      status={status}
      errorMessage="Não foi possível carregar a agenda do aluno."
      onRetry={onRetry}
      {...(onEvent ? { onEventActivate: onEvent } : {})}
      rangeSelection={calendarSelection(onCreate, events)}
      actions={onCreate ? <CalendarCreateAction onCreate={onCreate} /> : undefined}
      renderEvent={(event, context) => (
        <AgendaEventButton event={event} context={context} interactive={Boolean(onEvent)} />
      )}
    />
  );
}

function agendaStatus(error: boolean, pending: boolean): "error" | "loading" | "ready" {
  if (error) return "error";
  if (pending) return "loading";
  return "ready";
}

function CalendarCreateAction({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <Button id="student-agenda-new" size="sm" onClick={() => onCreate()}>
      <Plus aria-hidden="true" /> Novo atendimento
    </Button>
  );
}

function calendarSelection(
  onCreate: ((selection?: CalendarInterval) => void) | undefined,
  events: StudentEvent[],
): CalendarRangeSelection | undefined {
  if (!onCreate) return undefined;
  return {
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
  };
}

function AgendaEventButton({
  event,
  context,
  interactive,
}: {
  event: StudentEvent;
  context: CalendarEventRenderContext;
  interactive: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      id={event.kind === "appointment" ? "appointment-cell-" + event.recordId : undefined}
      className={styles.event}
      data-kind={event.kind}
      data-cancelled={event.cancelled || undefined}
      data-expanded={context.expanded || undefined}
      disabled={context.disabled || !interactive}
      onClick={context.activate}
      aria-label={`${event.title}, ${event.date}, ${event.startTime} às ${event.endTime}. ${event.subtitle}. ${event.statusLabel}`}
    >
      <strong data-calendar-detail>{event.title}</strong>
      <span className={styles.eventTime} data-calendar-detail>
        {event.startTime}–{event.endTime}
      </span>
      <span className={styles.eventTeacher} data-calendar-detail>
        {event.subtitle}
      </span>
      <span className={styles.eventStatus} data-calendar-detail>
        {event.statusLabel}
      </span>
    </button>
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
          {lesson.teacher ?? TEACHER_UNASSIGNED} ·{" "}
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
    subtitle: lesson.teacher ?? TEACHER_UNASSIGNED,
    statusLabel: lessonStatus(lesson),
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
    subtitle: appointment.teacher?.name ?? TEACHER_UNASSIGNED,
    statusLabel: appointmentStatus(appointment),
    cancelled: appointment.status === "CANCELLED",
  }));
  return [...lessons, ...appointments];
}

function lessonStatus(lesson: Agenda["lessons"][number]): string {
  if (lesson.state === "CANCELLED") return "Cancelada";
  if (lesson.state === "UPCOMING") return "Agendada";
  if (!lesson.sessionId) return "Prevista no horário da turma";
  if (lesson.state === "PENDING") return "Aguardando registro";
  return "Aula realizada";
}

function appointmentStatus(appointment: Agenda["appointments"][number]): string {
  if (appointment.status === "CANCELLED") {
    return appointment.rescheduledToId ? "Reagendado" : "Cancelado";
  }
  if (appointment.status === "ATTENDED") return "Realizado";
  if (appointment.status === "NO_SHOW") return "Não compareceu";
  return appointment.overdue ? "Aguardando registro" : "Agendado";
}
