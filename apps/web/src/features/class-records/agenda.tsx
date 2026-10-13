"use client";

import type { ReactElement } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RecordState } from "./shared";
import { GenerationState, useSessionGeneration } from "./generation-notice";
import { LessonCalendar } from "./calendar";
import { CalendarDatePicker } from "./calendar-date-picker";
import { calendarDate, monday, schoolToday, shiftDate, validDate } from "./calendar-model";
import styles from "./calendar.module.css";

export function ClassAgenda(): ReactElement {
  const today = schoolToday();
  const [params, setParams] = useQueryStates({
    semana: parseAsString.withDefault(monday(today)),
    turma: parseAsString,
    dia: parseAsString,
    visao: parseAsString.withDefault("week"),
  });
  const from = validDate(params.semana) ? monday(params.semana) : monday(today);
  const to = shiftDate(from, 6);
  const date =
    params.dia && validDate(params.dia) && params.dia >= from && params.dia <= to
      ? params.dia
      : today >= from && today <= to
        ? today
        : from;
  const mode = params.visao === "day" ? "day" : "week";
  const range = { from, to, ...(params.turma ? { classId: params.turma } : {}) };
  const query = trpc.classRecords.list.useQuery(range);
  const generation = useSessionGeneration(range);
  const lessons = query.data ?? [];
  const scopedLessons = mode === "day" ? lessons.filter((lesson) => lesson.date === date) : lessons;
  function selectDate(next: string) {
    void setParams({ semana: monday(next), dia: next });
  }
  function move(delta: number) {
    selectDate(shiftDate(mode === "day" ? date : from, mode === "day" ? delta : delta * 7));
  }
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className="font-display text-h2 font-semibold text-heading">Aulas</h1>
        <p className={styles.summary} aria-live="polite">
          {query.isPending ? (
            "Carregando aulas…"
          ) : query.isError ? (
            "Agenda indisponível"
          ) : (
            <>
              <strong>{scopedLessons.length}</strong>{" "}
              {scopedLessons.length === 1 ? "aula" : "aulas"}{" "}
              {mode === "day" ? "no dia" : "na semana"}
              <span>·</span>
              <strong>
                {scopedLessons.filter((lesson) => lesson.state === "PENDING").length}
              </strong>{" "}
              a registrar
            </>
          )}
        </p>
      </header>
      <section className={styles.calendar} aria-label="Agenda de aulas">
        <div className={styles.toolbar}>
          <div className={styles.dateControls}>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={mode === "day" ? "Dia anterior" : "Semana anterior"}
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={mode === "day" ? "Próximo dia" : "Próxima semana"}
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <CalendarDatePicker date={date} today={today} onChange={selectDate} />
            <Button variant="secondary" size="sm" onClick={() => selectDate(today)}>
              Hoje
            </Button>
          </div>
          <div className={styles.viewControls}>
            <span className={styles.range}>
              {calendarDate(from, { day: "numeric", month: "short" })} —{" "}
              {calendarDate(to, { day: "numeric", month: "short" })}
            </span>
            <SegmentedControl
              value={mode}
              onValueChange={(value) => {
                if (value) void setParams({ visao: value });
              }}
              size="sm"
              aria-label="Visualização do calendário"
            >
              <SegmentedControlItem value="week">Semana</SegmentedControlItem>
              <SegmentedControlItem value="day">Dia</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </div>
        {params.turma && (
          <div className={styles.activeFilters}>
            <span>
              Turma: {lessons[0]?.className ?? generation.data?.[0]?.className ?? "selecionada"}
            </span>
            <Button variant="text" size="sm" onClick={() => void setParams({ turma: null })}>
              <X /> Ver todas as turmas
            </Button>
          </div>
        )}
        {query.isPending || query.error ? (
          <div className="p-4">
            <RecordState
              pending={query.isPending}
              error={query.error}
              retry={() => void query.refetch()}
            />
          </div>
        ) : (
          <LessonCalendar
            key={from}
            from={from}
            today={today}
            date={date}
            mode={mode}
            lessons={lessons}
            onSelectDay={(day) => void setParams({ dia: day, visao: "day" })}
          />
        )}
      </section>
      <GenerationState query={generation} showReady={Boolean(params.turma)} />
    </div>
  );
}
