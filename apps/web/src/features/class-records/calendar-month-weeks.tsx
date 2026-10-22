import type { ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { calendarDate, monday } from "./calendar-model";
import { adjacentMonth, monthWeeks } from "./calendar-month-weeks-model";
import styles from "./calendar-month-weeks.module.css";

export function CalendarMonthWeeks({
  date,
  onSelectDate,
}: {
  date: string;
  onSelectDate: (date: string) => void;
}): ReactElement {
  return (
    <div className={styles.selector} role="group" aria-label="Semanas do mês">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mês anterior"
        onClick={() => onSelectDate(adjacentMonth(date, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className={styles.month}>
        {calendarDate(date, { month: "short", year: "numeric" })}
      </span>
      <div className={styles.weeks}>
        {monthWeeks(date).map((week) => (
          <button
            key={week.from}
            type="button"
            className={styles.week}
            aria-pressed={week.from === monday(date)}
            aria-label={`Semana de ${calendarDate(week.from, { day: "numeric", month: "long" })} a ${calendarDate(week.through, { day: "numeric", month: "long" })}`}
            onClick={() => onSelectDate(week.selectDate)}
          >
            {calendarDate(week.from, { day: "2-digit" })}–
            {calendarDate(week.through, { day: "2-digit" })}
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Próximo mês"
        onClick={() => onSelectDate(adjacentMonth(date, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
