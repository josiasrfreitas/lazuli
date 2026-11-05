"use client";

import { useState, type ReactElement } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { X } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { ScheduleAppointmentDialog } from "~/features/appointments/schedule-dialog";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { GenerationState, useSessionGeneration } from "./generation-notice";
import { LessonCalendar } from "./calendar";
import { agendaEvents, monday, schoolToday, shiftDate } from "./calendar-model";
import { AgendaHeader } from "./agenda-header";
import { AgendaStudentChip } from "./agenda-student-chip";
import { agendaDate } from "./weekly-calendar-model";
import styles from "./calendar.module.css";

const LAST_WEEKDAY = 6;
type AgendaView = "dia" | "semana";
type InitialQuery<T> = { data: T; updatedAt: number };
export type InitialAgendaData = {
  today: string;
  lessons?: InitialQuery<RouterOutputs["classRecords"]["list"]>;
  appointments?: InitialQuery<RouterOutputs["appointments"]["list"]>;
  experiments?: InitialQuery<RouterOutputs["classRecords"]["experimentalSessions"]>;
};

function initialQueryOptions<T>(initial?: InitialQuery<T>): {
  initialData?: T;
  initialDataUpdatedAt?: number;
} {
  return initial ? { initialData: initial.data, initialDataUpdatedAt: initial.updatedAt } : {};
}

type AgendaDataProps = {
  teacherView: boolean;
  date: string;
  view: AgendaView;
  classId: string | null;
  studentId: string | null;
  admin: boolean;
  selectDate: (date: string) => void;
  selectDay: (date: string) => void;
  changeView: (view: AgendaView) => void;
  clearClass: () => void;
  clearStudent: () => void;
  schedule: () => void;
  initial?: InitialAgendaData | undefined;
};

export function ClassAgenda({
  teacherView = false,
  admin = false,
  initial,
}: {
  teacherView?: boolean;
  admin?: boolean;
  initial?: InitialAgendaData;
}): ReactElement {
  const today = schoolToday();
  const [creating, setCreating] = useState(false);
  const readyInitial = initial?.today === today ? initial : undefined;
  const [params, setParams] = useQueryStates({
    semana: parseAsString.withDefault(monday(today)),
    turma: parseAsString,
    aluno: parseAsString,
    dia: parseAsString,
    visao: parseAsStringLiteral(["dia", "semana"]).withDefault("dia"),
  });
  const date = agendaDate(today, { day: params.dia, week: params.semana });
  function selectDate(next: string): void {
    void setParams({ semana: monday(next), dia: next });
  }
  return (
    <div className={styles.page} data-teacher={teacherView}>
      {!teacherView && (
        <AgendaHeader date={date} view={params.visao} today={today} onSelectDate={selectDate} />
      )}
      {creating && <ScheduleAppointmentDialog onClose={() => setCreating(false)} />}
      <AgendaData
        teacherView={teacherView}
        date={date}
        view={params.visao}
        classId={params.turma}
        studentId={params.aluno}
        admin={admin}
        selectDate={selectDate}
        selectDay={(next) => void setParams({ semana: monday(next), dia: next, visao: "dia" })}
        changeView={(visao) => void setParams({ visao })}
        clearClass={() => void setParams({ turma: null })}
        clearStudent={() => void setParams({ aluno: null })}
        schedule={() => setCreating(true)}
        initial={readyInitial}
      />
    </div>
  );
}

function AgendaData(props: AgendaDataProps): ReactElement {
  const selectedWeek = monday(props.date);
  const range = {
    from: selectedWeek,
    to: shiftDate(selectedWeek, LAST_WEEKDAY),
    ...(props.classId ? { classId: props.classId } : {}),
  };
  const sameWeek = props.initial !== undefined && selectedWeek === monday(props.initial.today);
  const query = trpc.classRecords.list.useQuery(
    range,
    initialQueryOptions(sameWeek && !props.classId ? props.initial?.lessons : undefined),
  );
  const appointments = trpc.appointments.list.useQuery(
    {
      from: range.from,
      through: range.to,
      ...(props.studentId ? { studentId: props.studentId } : {}),
    },
    initialQueryOptions(sameWeek && !props.studentId ? props.initial?.appointments : undefined),
  );
  const experiments = trpc.classRecords.experimentalSessions.useQuery(
    { from: range.from, to: range.to },
    initialQueryOptions(sameWeek ? props.initial?.experiments : undefined),
  );
  const generation = useSessionGeneration(range);
  const pending = [query.isPending, appointments.isPending, experiments.isPending].some(Boolean);
  const error = firstAgendaError(query.error, appointments.error, experiments.error);
  const lessons = query.data ?? [];
  const events = agendaEvents(lessons, {
    appointments: appointments.data ?? [],
    experiments: experiments.data ?? [],
  });
  return (
    <>
      <AgendaCalendarView
        {...props}
        lessons={events}
        className={agendaClassName(lessons, generation.data)}
        studentName={agendaStudentName(appointments.data)}
        status={agendaStatus(pending, Boolean(error))}
        errorMessage={error?.message ?? "Não foi possível carregar a agenda."}
        retry={() => {
          void query.refetch();
          void appointments.refetch();
          void experiments.refetch();
        }}
      />
      <GenerationState query={generation} showReady={Boolean(props.classId)} />
    </>
  );
}

function firstAgendaError(
  ...errors: ({ message: string } | null)[]
): { message: string } | undefined {
  return errors.find(Boolean) ?? undefined;
}

function agendaClassName(
  lessons: { className: string }[],
  generation: { className: string }[] | undefined,
): string {
  return lessons[0]?.className ?? generation?.[0]?.className ?? "selecionada";
}

function agendaStudentName(
  appointments: { student: { name: string } }[] | undefined,
): string | undefined {
  return appointments?.[0]?.student.name;
}

function agendaStatus(pending: boolean, error: boolean): "loading" | "error" | "ready" {
  if (pending) return "loading";
  if (error) return "error";
  return "ready";
}

type CalendarViewProps = AgendaDataProps & {
  lessons: ReturnType<typeof agendaEvents>;
  className: string;
  studentName: string | undefined;
  status: "loading" | "error" | "ready";
  errorMessage: string;
  retry: () => void;
};
function AgendaCalendarView(props: CalendarViewProps): ReactElement {
  return (
    <section className={styles.calendar} aria-label="Agenda de aulas e atendimentos">
      {props.classId && <ActiveClassFilter className={props.className} clear={props.clearClass} />}
      <LessonCalendar
        teacherView={props.teacherView}
        status={props.status}
        errorMessage={props.errorMessage}
        onRetry={props.retry}
        date={props.date}
        view={props.view}
        onViewChange={props.changeView}
        onNavigateDate={props.selectDate}
        onSelectDay={props.selectDay}
        studentFilter={
          props.studentId ? (
            <AgendaStudentChip
              id={props.studentId}
              name={props.studentName}
              admin={props.admin}
              onClear={props.clearStudent}
            />
          ) : null
        }
        lessons={props.lessons}
        onSchedule={props.admin ? props.schedule : undefined}
      />
    </section>
  );
}

function ActiveClassFilter({
  className,
  clear,
}: {
  className: string;
  clear: () => void;
}): ReactElement {
  return (
    <div className={styles.activeFilters}>
      <span>
        Aulas da turma: {className}. Outras aulas estão ocultas; atendimentos continuam visíveis.
      </span>
      <Button variant="text" size="sm" onClick={clear}>
        <X /> Ver todas as turmas
      </Button>
    </div>
  );
}
