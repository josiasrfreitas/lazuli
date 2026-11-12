"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import {
  ScheduleCalendar,
  getScheduleCalendarRange,
  type CalendarEvent,
  type CalendarView,
} from "@lazuli/ui";
import { MeetingDialog, type Meeting } from "./meeting-dialog";
import { trpc } from "~/lib/trpc";
import { mondayOf, todayInSchool } from "./format";
import type { RouterOutputs } from "@lazuli/api";
import styles from "./teacher-overview.module.css";

type Event = CalendarEvent & { href: string; meeting?: Meeting };
type Week = RouterOutputs["teachers"]["week"];
export function TeacherDatedAgenda({ id, back }: { id: string; back: string }): ReactElement {
  const [date, setDate] = useState(todayInSchool);
  const [view, setView] = useState<CalendarView>("week");
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const query = trpc.teachers.week.useQuery(
    { id, week: mondayOf(date) },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const events = query.data ? agendaEvents(query.data, id) : [];
  const range = getScheduleCalendarRange({ date, view });
  const visible = events.filter((event) => event.date >= range.from && event.date <= range.through);
  const hours = occupiedHours(visible);
  return (
    <section className={styles.agenda} aria-label="Agenda do professor">
      <div>
        <h2>Agenda do professor</h2>
        <p className="text-caption text-muted-foreground">
          Aulas, atendimentos e experimentais · horário de São Paulo
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Clique em uma aula futura para escolher um substituto só para aquela data. Aulas já
          iniciadas ou com registros ficam bloqueadas.
        </p>
      </div>
      <ScheduleCalendar
        date={date}
        view={view}
        onDateChange={setDate}
        onViewChange={setView}
        events={events}
        hours={hours}
        scrollChaining
        emptyDisplay="message"
        density="compact"
        status={query.isError ? "error" : query.isPending ? "loading" : "ready"}
        onRetry={() => void query.refetch()}
        onEventActivate={(event) =>
          event.meeting ? setMeeting(event.meeting) : router.push(event.href)
        }
        label="Aulas e atendimentos do professor"
        emptyMessage="Nenhuma aula ou atendimento neste período."
      />
      {meeting && <MeetingDialog meeting={meeting} back={back} onClose={() => setMeeting(null)} />}
    </section>
  );
}
function agendaEvents(data: Week, teacherId: string): Event[] {
  return [
    ...data.rows
      .filter((row) => !row.cancelled)
      .map((row) => ({
        id: `class:${row.classId}:${row.date}:${row.startTime}`,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        title: row.className,
        subtitle: row.substituteTeacherId
          ? `Substituição · ${row.substituteTeacherName ?? "Professor"}`
          : (row.stageName ?? "Aula"),
        tone:
          row.substituteTeacherId && row.substituteTeacherId !== teacherId
            ? ("warning" as const)
            : ("info" as const),
        meeting: row,
        disabled: !row.editable,
        ...(!row.editable
          ? {
              disabledReason:
                "Esta aula já começou ou possui registros. Não é possível alterar o professor.",
            }
          : {
              description: row.substituteTeacherId
                ? "Consultar substituição"
                : "Clique para registrar uma substituição nesta aula",
            }),
        href: `/turmas/${row.classId}`,
      })),
    ...data.appointments
      .filter((row) => row.status !== "CANCELLED")
      .map((row) => ({
        id: `appointment:${row.id}`,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        title: row.studentName,
        subtitle: "Atendimento",
        tone: "accent" as const,
        href: `/alunos/${row.studentId}?secao=pedagogico`,
      })),
    ...data.introductions
      .filter((row) => row.status !== "CANCELLED")
      .map((row) => ({
        id: `introduction:${row.id}`,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        title: row.candidateName,
        subtitle: "Experimental",
        tone: "neutral" as const,
        href: `/interessados/${row.candidateId}`,
      })),
  ];
}

function occupiedHours(events: Event[]): { start: string; end: string } {
  if (!events.length) return { start: "08:00", end: "12:00" };
  const minutes = (time: string): number => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! * 60 + minute!;
  };
  const start = Math.floor(Math.min(...events.map((event) => minutes(event.startTime))) / 60);
  const end = Math.ceil(Math.max(...events.map((event) => minutes(event.endTime))) / 60);
  return {
    start: `${String(start).padStart(2, "0")}:00`,
    end: `${String(end).padStart(2, "0")}:00`,
  };
}
