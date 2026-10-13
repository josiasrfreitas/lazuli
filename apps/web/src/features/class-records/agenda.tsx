"use client";

import { useState, type ReactElement } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RecordState } from "./shared";
import { GenerationState, useSessionGeneration } from "./generation-notice";
import { LessonCalendar } from "./calendar";
import { CalendarDatePicker } from "./calendar-date-picker";
import {
  calendarDate,
  lessonStates,
  monday,
  schoolToday,
  shiftDate,
  validDate,
} from "./calendar-model";
import styles from "./calendar.module.css";

export function ClassAgenda(): ReactElement {
  const today = schoolToday();
  const [params, setParams] = useQueryStates({
    semana: parseAsString.withDefault(monday(today)),
    turma: parseAsString,
    dia: parseAsString,
    visao: parseAsString.withDefault("week"),
  });
  const [state, setState] = useState("all");
  const [teacher, setTeacher] = useState("all");
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
  const all = query.data ?? [];
  const teachers = [
    ...new Set(all.map((lesson) => lesson.teacher ?? "Professor a definir")),
  ].sort();
  if (teacher !== "all" && !teachers.includes(teacher)) teachers.push(teacher);
  const teacherLessons = all.filter(
    (lesson) => teacher === "all" || (lesson.teacher ?? "Professor a definir") === teacher,
  );
  const lessons = teacherLessons.filter((lesson) => state === "all" || lesson.state === state);
  const scopedLessons = mode === "day" ? lessons.filter((lesson) => lesson.date === date) : lessons;
  function selectDate(next: string) {
    void setParams({ semana: monday(next), dia: next });
  }
  function move(delta: number) {
    selectDate(shiftDate(mode === "day" ? date : from, mode === "day" ? delta : delta * 7));
  }
  const filtersActive = teacher !== "all" || state !== "all" || Boolean(params.turma);
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className="font-display text-h2 font-semibold text-heading">Aulas</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            A semana da escola, encontro por encontro.
          </p>
        </div>
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
        <div className={styles.filters}>
          <div className={styles.statusFilters} aria-label="Situação das aulas">
            {[
              { value: "all", label: "Todas" },
              ...Object.entries(lessonStates).map(([value, label]) => ({ value, label })),
            ].map((filter) => (
              <button
                type="button"
                key={filter.value}
                aria-pressed={state === filter.value}
                data-selected={state === filter.value}
                className={styles.statusFilter}
                onClick={() => setState(filter.value)}
              >
                {filter.label}
                <span>
                  {
                    teacherLessons.filter(
                      (lesson) =>
                        (filter.value === "all" || lesson.state === filter.value) &&
                        (mode === "week" || lesson.date === date),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className={styles.teacherFilter}>
            <Select
              value={teacher}
              onValueChange={(value) => {
                if (value) setTeacher(value);
              }}
            >
              <SelectTrigger size="sm" aria-label="Filtrar por professor">
                <SelectValue>{teacher === "all" ? "Todos os professores" : teacher}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os professores</SelectItem>
                {teachers.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtersActive && (
          <div className={styles.activeFilters}>
            <span>
              {params.turma
                ? `Turma: ${all[0]?.className ?? generation.data?.[0]?.className ?? "selecionada"}`
                : "Agenda filtrada"}
            </span>
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                setTeacher("all");
                setState("all");
                void setParams({ turma: null });
              }}
            >
              <X />
              Limpar filtros
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
            key={`${from}-${teacher}-${state}`}
            from={from}
            today={today}
            date={date}
            mode={mode}
            lessons={lessons}
            onSelectDay={(day) => void setParams({ dia: day, visao: "day" })}
          />
        )}
        <footer className={styles.footer}>
          <span>Horários de Brasília</span>
          <span>Selecione uma aula para ver os detalhes.</span>
        </footer>
      </section>
      <GenerationState query={generation} showReady={Boolean(params.turma)} />
    </div>
  );
}
