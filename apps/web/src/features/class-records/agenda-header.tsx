import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { calendarDate, monday, shiftDate } from "./calendar-model";
import { CalendarMonthWeeks } from "./calendar-month-weeks";
import { CalendarWeek } from "./calendar-week";
import styles from "./calendar.module.css";

const LAST_WEEKDAY = 6;

export function AgendaHeader({
  date,
  view,
  today,
  onSelectDate,
}: {
  date: string;
  view: "dia" | "semana";
  today: string;
  onSelectDate: (date: string) => void;
}): ReactElement {
  const from = monday(date);
  const period =
    view === "semana"
      ? `${calendarDate(from, { day: "numeric", month: "short" })} – ${calendarDate(shiftDate(from, LAST_WEEKDAY), { day: "numeric", month: "short", year: "numeric" })}`
      : calendarDate(date, { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageIdentity}>
        <h1 className={styles.agendaTitle}>Agenda</h1>
        <span className={styles.dateSubtitle}>
          {view === "semana" ? "Visão semanal" : "Visão diária"} · horários de São Paulo
        </span>
        <span className={styles.dateSubtitle}>{period}</span>
        <Button variant="ghost" size="sm" onClick={() => onSelectDate(today)}>
          Hoje
        </Button>
      </div>
      <div className={styles.agendaNavigation}>
        {view === "semana" ? (
          <CalendarMonthWeeks date={date} onSelectDate={onSelectDate} />
        ) : (
          <CalendarWeek
            from={from}
            today={today}
            date={date}
            onSelectDay={onSelectDate}
            onChangeWeek={onSelectDate}
          />
        )}
      </div>
    </header>
  );
}
