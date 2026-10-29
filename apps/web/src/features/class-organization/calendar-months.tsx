import type { JSX as ReactJSX } from "react";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly } from "~/features/class-organization/shared";
import type { OrganizationAction, OrganizationBoard } from "./model";
import styles from "./organization.module.css";

const ISO_MONTH_LENGTH = 7;
const ISO_DATE_LENGTH = 10;
const CALENDAR_UTC_HOUR = 12;

export function CalendarMonths({
  board,
  start,
  end,
  onAction,
}: {
  board: OrganizationBoard;
  start: string;
  end: string;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.scroll}>
      <div className={`${styles.row} px-4 pt-3`}>
        <span className={styles.small}>
          Calendário letivo · selecione uma data para registrar uma exceção
        </span>
        <span className={`${styles.small} ${styles.attention}`}>Sublinhado: dia sem aula</span>
      </div>
      <div className={styles.months}>
        {semesterMonths(start, end).map((month) => (
          <CalendarMonth
            key={month.toISOString()}
            month={month}
            board={board}
            start={start}
            end={end}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

function semesterMonths(start: string, end: string): Date[] {
  const months: Date[] = [];
  for (
    let date = new Date(`${start.slice(0, ISO_MONTH_LENGTH)}-01T12:00:00Z`);
    date.toISOString().slice(0, ISO_DATE_LENGTH) <= end;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, CALENDAR_UTC_HOUR))
  )
    months.push(date);
  return months;
}

function CalendarMonth({
  month,
  board,
  start,
  end,
  onAction,
}: {
  month: Date;
  board: OrganizationBoard;
  start: string;
  end: string;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  return (
    <section className={styles.month}>
      <h3>
        {new Intl.DateTimeFormat("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(month)}
      </h3>
      <div className={styles.days}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, position) => (
          <span key={position}>{day}</span>
        ))}
        {Array.from({ length: month.getUTCDay() }, (_unused, position) => (
          <span key={`empty-${position}`} />
        ))}
        {Array.from({ length: count }, (_unused, position) => (
          <CalendarDay
            key={position}
            date={`${month.toISOString().slice(0, ISO_MONTH_LENGTH)}-${String(position + 1).padStart(2, "0")}`}
            day={position + 1}
            board={board}
            start={start}
            end={end}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarDay({
  date,
  day,
  board,
  start,
  end,
  onAction,
}: {
  date: string;
  day: number;
  board: OrganizationBoard;
  start: string;
  end: string;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  const closed = board.closedDays.find((item) => dateOnly(item.date) === date);
  return (
    <button
      type="button"
      data-closed={Boolean(closed)}
      data-boundary={date === start || date === end}
      data-outside={date < start || date > end}
      title={`${formatDateOnlyBR(date)}${closed ? ` · ${closed.reason}` : ""}`}
      aria-label={`${formatDateOnlyBR(date)}${closed ? `, ${closed.reason}` : ", registrar dia sem aula"}`}
      onClick={() => onAction({ kind: "closure", date })}
    >
      {day}
    </button>
  );
}
