"use client";

import type { JSX as ReactJSX, ReactNode } from "react";
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
type View = "dia" | "semana";
type Props = {
  date: string;
  view: View;
  onSelectDate: (date: string) => void;
  onViewChange: (view: View) => void;
  filters: ReactNode;
  restricted: boolean;
};

export function TeacherAgendaHeader(props: Props): ReactJSX.Element {
  const today = schoolToday();
  const from = monday(props.date);
  return (
    <header className={styles.header}>
      <h1 className="sr-only">Minha agenda</h1>
      <div className={styles.toolbar}>
        <AgendaDatePicker date={props.date} today={today} onSelectDate={props.onSelectDate} />
        <ShortNavigation {...props} />
        <Button variant="ghost" size="sm" onClick={() => props.onSelectDate(today)}>
          <CalendarDays aria-hidden="true" />
          Hoje
        </Button>
        <ViewControl view={props.view} onViewChange={props.onViewChange} />
        <AgendaFilters restricted={props.restricted} filters={props.filters} />
      </div>
      <DateNavigation {...props} from={from} today={today} />
    </header>
  );
}

function AgendaDatePicker({
  date,
  today,
  onSelectDate,
}: Pick<Props, "date" | "onSelectDate"> & { today: string }): ReactJSX.Element {
  return (
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
  );
}

function ShortNavigation({ date, view, onSelectDate }: Props): ReactJSX.Element {
  return (
    <div className={styles.shortNavigation}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={view === "dia" ? "Dia anterior" : "Semana anterior"}
        onClick={() => onSelectDate(shiftDate(date, view === "dia" ? -1 : PREVIOUS_WEEK_OFFSET))}
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
  );
}

function ViewControl({
  view,
  onViewChange,
}: Pick<Props, "view" | "onViewChange">): ReactJSX.Element {
  return (
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
  );
}

function AgendaFilters({
  restricted,
  filters,
}: Pick<Props, "restricted" | "filters">): ReactJSX.Element {
  return (
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
  );
}

function DateNavigation({
  date,
  view,
  from,
  today,
  onSelectDate,
}: Pick<Props, "date" | "view" | "onSelectDate"> & {
  from: string;
  today: string;
}): ReactJSX.Element {
  return (
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
  );
}
