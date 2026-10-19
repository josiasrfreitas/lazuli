"use client";

import { useState, type ReactElement } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { X } from "lucide-react";
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

export function ClassAgenda(): ReactElement {
  const today = schoolToday();
  const [creating, setCreating] = useState(false);
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const [params, setParams] = useQueryStates({
    semana: parseAsString.withDefault(monday(today)),
    turma: parseAsString,
    aluno: parseAsString,
    dia: parseAsString,
    visao: parseAsStringLiteral(["dia", "semana"]).withDefault("dia"),
  });
  const date = agendaDate(today, { day: params.dia, week: params.semana });
  const selectedWeek = monday(date);
  const range = {
    from: selectedWeek,
    to: shiftDate(selectedWeek, LAST_WEEKDAY),
    ...(params.turma ? { classId: params.turma } : {}),
  };
  const query = trpc.classRecords.list.useQuery(range);
  const appointments = trpc.appointments.list.useQuery({
    from: range.from,
    through: range.to,
    ...(params.aluno ? { studentId: params.aluno } : {}),
  });
  const experiments = trpc.classRecords.experimentalSessions.useQuery({
    from: range.from,
    to: range.to,
  });
  const generation = useSessionGeneration(range);
  const pending = query.isPending || appointments.isPending || experiments.isPending;
  const error = query.error ?? appointments.error ?? experiments.error;
  const settledStatus = error ? "error" : "ready";
  const lessons = query.data ?? [];
  const events = agendaEvents(lessons, appointments.data ?? [], experiments.data ?? []);
  function selectDate(next: string): void {
    void setParams({ semana: monday(next), dia: next });
  }
  return (
    <div className={styles.page}>
      <AgendaHeader date={date} view={params.visao} today={today} onSelectDate={selectDate} />
      {creating && <ScheduleAppointmentDialog onClose={() => setCreating(false)} />}
      <section className={styles.calendar} aria-label="Agenda de aulas e atendimentos">
        {params.turma && (
          <div className={styles.activeFilters}>
            <span>
              Aulas da turma:{" "}
              {lessons[0]?.className ?? generation.data?.[0]?.className ?? "selecionada"}. Outras
              aulas estão ocultas; atendimentos continuam visíveis.
            </span>
            <Button variant="text" size="sm" onClick={() => void setParams({ turma: null })}>
              <X /> Ver todas as turmas
            </Button>
          </div>
        )}
        <LessonCalendar
          status={pending ? "loading" : settledStatus}
          errorMessage={error?.message ?? "Não foi possível carregar a agenda."}
          onRetry={() => {
            void query.refetch();
            void appointments.refetch();
            void experiments.refetch();
          }}
          date={date}
          view={params.visao}
          onViewChange={(visao) => void setParams({ visao })}
          onSelectDay={(next) => void setParams({ semana: monday(next), dia: next, visao: "dia" })}
          studentFilter={
            params.aluno ? (
              <AgendaStudentChip
                id={params.aluno}
                name={appointments.data?.[0]?.student.name}
                admin={admin}
                onClear={() => void setParams({ aluno: null })}
              />
            ) : null
          }
          lessons={events}
          onSchedule={admin ? () => setCreating(true) : undefined}
        />
      </section>
      <GenerationState query={generation} showReady={Boolean(params.turma)} />
    </div>
  );
}
