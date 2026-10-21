"use client";

import type { JSX as ReactJSX } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { CalendarDatePicker } from "./calendar-date-picker";
import { CalendarWeek } from "./calendar-week";
import { calendarDate, monday, schoolToday, shiftDate } from "./calendar-model";
import styles from "./teacher-agenda.module.css";

const PREVIOUS_WEEK_OFFSET = -7;
const DAYS_PER_WEEK = 7;
const WEEK_END_OFFSET = 6;

export function TeacherAgendaHeader({
  date,
  view,
  onSelectDate,
  onViewChange,
  filters,
  restricted,
}: {
  date: string;
  view: "dia" | "semana";
  onSelectDate: (date: string) => void;
  onViewChange: (view: "dia" | "semana") => void;
  filters: ReactNode;
  restricted: boolean;
}): ReactJSX.Element {
  const today = schoolToday();
  const from = monday(date);
  return (
    <header className={styles.header}>
      <h1 className="sr-only">Minha agenda</h1>
      <div className={styles.toolbar}>
        <CalendarDatePicker
          date={date}
          today={today}
          onChange={onSelectDate}
          trigger={
            <button
              type="button"
              className={styles.month}
              aria-label={`Escolher data, ${calendarDate(date, { month: "long", year: "numeric" })}`}
            >
              <span className={styles.monthLabel}>{calendarDate(date, { month: "long" })}</span>
              <span className={styles.shortDate}>
                {calendarDate(date, { day: "numeric", month: "short" })}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
          }
        />
        <div className={styles.shortNavigation}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={view === "dia" ? "Dia anterior" : "Semana anterior"}
            onClick={() =>
              onSelectDate(shiftDate(date, view === "dia" ? -1 : PREVIOUS_WEEK_OFFSET))
            }
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={view === "dia" ? "Próximo dia" : "Próxima semana"}
            onClick={() => onSelectDate(shiftDate(date, view === "dia" ? 1 : DAYS_PER_WEEK))}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelectDate(today)}>
          <CalendarDays aria-hidden="true" />
          Hoje
        </Button>
        <SegmentedControl
          size="sm"
          aria-label="Visualização da agenda"
          value={view}
          onValueChange={(value) => {
            if (value === "dia" || value === "semana") onViewChange(value);
          }}
        >
          <SegmentedControlItem value="dia">Dia</SegmentedControlItem>
          <SegmentedControlItem value="semana">Semana</SegmentedControlItem>
        </SegmentedControl>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant={restricted ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={restricted ? "Filtros da agenda, filtros ativos" : "Filtros da agenda"}
              />
            }
          >
            <SlidersHorizontal aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" size="md">
            <div className="grid gap-3">
              <PopoverTitle>Filtrar agenda</PopoverTitle>
              {filters}
              <p className="text-caption text-muted-foreground">Horários de São Paulo.</p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className={styles.dateNavigation}>
        {view === "dia" ? (
          <CalendarWeek
            compact
            from={from}
            today={today}
            date={date}
            onSelectDay={onSelectDate}
            onChangeWeek={onSelectDate}
          />
        ) : (
          <div className={styles.weekNavigation}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Semana anterior"
              onClick={() => onSelectDate(shiftDate(date, PREVIOUS_WEEK_OFFSET))}
            >
              <ChevronLeft />
            </Button>
            <span>
              {calendarDate(from, { day: "numeric", month: "short" })} –{" "}
              {calendarDate(shiftDate(from, WEEK_END_OFFSET), { day: "numeric", month: "short" })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Próxima semana"
              onClick={() => onSelectDate(shiftDate(date, DAYS_PER_WEEK))}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
