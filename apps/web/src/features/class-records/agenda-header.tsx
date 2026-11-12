import { CalendarDays } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { monday } from "./calendar-model";
import { CalendarMonthWeeks } from "./calendar-month-weeks";
import { CalendarWeek } from "./calendar-week";
import styles from "./calendar.module.css";

export function AgendaHeader({
  date,
  view,
  today,
  onSelectDate,
  title = "Agenda",
}: {
  title?: string;
  date: string;
  view: "dia" | "semana";
  today: string;
  onSelectDate: (date: string) => void;
}): ReactElement {
  const from = monday(date);
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageIdentity}>
        <h1 className={styles.agendaTitle}>{title}</h1>
        <Button variant="ghost" size="sm" onClick={() => onSelectDate(today)}>
          <CalendarDays aria-hidden="true" />
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
