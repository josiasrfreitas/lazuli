"use client";
import { useState, type ReactElement } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "./popover";
import { calendarDateError, clampCalendarDate } from "./schedule-calendar/date-window";
import { monday, shiftDate } from "./schedule-calendar/model";
const MONTH_LENGTH = 7;
const DATE_LENGTH = 10;
const CALENDAR_CELLS = 42;
const DAY_LENGTH = 2;
const monthKey = (date: string): string => date.slice(0, MONTH_LENGTH);
function calendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
function moveMonth(date: string, delta: number): string {
  const value = new Date(`${monthKey(date)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return value.toISOString().slice(0, DATE_LENGTH);
}
type PickerProps = {
  trigger?: ReactElement | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  date: string;
  today: string;
  onChange: (date: string) => void;
};
function MonthHeader({
  month,
  minDate,
  maxDate,
  onChange,
}: {
  month: string;
  minDate: string | undefined;
  maxDate: string | undefined;
  onChange: (month: string) => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Mês anterior"
        disabled={Boolean(minDate && monthKey(month) <= monthKey(minDate))}
        onClick={() => onChange(moveMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <PopoverTitle>{calendarDate(month, { month: "long", year: "numeric" })}</PopoverTitle>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Próximo mês"
        disabled={Boolean(maxDate && monthKey(month) >= monthKey(maxDate))}
        onClick={() => onChange(moveMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
function MonthGrid({
  month,
  props,
  onSelect,
}: {
  month: string;
  props: PickerProps;
  onSelect: (date: string) => void;
}): ReactElement {
  const start = monday(month);
  return (
    <div className="lz-calendar-monthGrid">
      {["S", "T", "Q", "Q", "S", "S", "D"].map((name, index) => (
        <span key={index} className="lz-calendar-monthWeekday" aria-hidden>
          {name}
        </span>
      ))}
      {Array.from({ length: CALENDAR_CELLS }, (_value, index) => {
        const day = shiftDate(start, index);
        return (
          <button
            key={day}
            type="button"
            disabled={Boolean(calendarDateError(day, props))}
            className="lz-calendar-monthDay"
            data-outside={monthKey(day) !== monthKey(month)}
            data-selected={day === props.date}
            data-today={day === props.today}
            aria-current={day === props.today ? "date" : undefined}
            aria-pressed={day === props.date}
            aria-label={calendarDate(day, { day: "numeric", month: "long", year: "numeric" })}
            onClick={() => onSelect(day)}
          >
            {Number(day.slice(-DAY_LENGTH))}
          </button>
        );
      })}
    </div>
  );
}
export function ScheduleCalendarDatePicker(props: PickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(`${monthKey(props.date)}-01`);
  function select(date: string): void {
    if (calendarDateError(date, props)) return;
    props.onChange(date);
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(`${monthKey(clampCalendarDate(props.date, props))}-01`);
      }}
    >
      {props.trigger ? (
        <PopoverTrigger render={props.trigger} />
      ) : (
        <PopoverTrigger className="lz-calendar-monthTrigger">
          {calendarDate(props.date, { month: "long", year: "numeric" }).replace(/^./, (letter) =>
            letter.toUpperCase(),
          )}
          <ChevronDown aria-hidden />
        </PopoverTrigger>
      )}
      <PopoverContent size="md" showArrow={false} align="start">
        <div className="grid gap-3">
          <MonthHeader
            month={month}
            minDate={props.minDate}
            maxDate={props.maxDate}
            onChange={setMonth}
          />
          <MonthGrid month={month} props={props} onSelect={select} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={Boolean(calendarDateError(props.today, props))}
            onClick={() => select(props.today)}
          >
            Ir para hoje
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
