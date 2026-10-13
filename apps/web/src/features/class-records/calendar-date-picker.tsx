"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@lazuli/ui";
import { calendarDate, monday, shiftDate } from "./calendar-model";
import styles from "./calendar.module.css";

function moveMonth(date: string, delta: number) {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return value.toISOString().slice(0, 10);
}

export function CalendarDatePicker({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7) + "-01");
  const start = monday(month);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(date.slice(0, 7) + "-01");
      }}
    >
      <PopoverTrigger className={styles.monthTrigger}>
        {calendarDate(date, { month: "long", year: "numeric" }).replace(/^./, (letter) =>
          letter.toUpperCase(),
        )}
        <ChevronDown aria-hidden />
      </PopoverTrigger>
      <PopoverContent size="md" showArrow={false} align="start">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mês anterior"
              onClick={() => setMonth(moveMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <PopoverTitle>{calendarDate(month, { month: "long", year: "numeric" })}</PopoverTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo mês"
              onClick={() => setMonth(moveMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className={styles.monthGrid}>
            {["S", "T", "Q", "Q", "S", "S", "D"].map((name, index) => (
              <span key={index} className={styles.monthWeekday} aria-hidden>
                {name}
              </span>
            ))}
            {Array.from({ length: 42 }, (_, index) => {
              const day = shiftDate(start, index);
              return (
                <button
                  key={day}
                  type="button"
                  className={styles.monthDay}
                  data-outside={day.slice(0, 7) !== month.slice(0, 7)}
                  data-selected={day === date}
                  data-today={day === today}
                  aria-current={day === today ? "date" : undefined}
                  aria-pressed={day === date}
                  aria-label={calendarDate(day, { day: "numeric", month: "long", year: "numeric" })}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
          >
            Ir para hoje
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
