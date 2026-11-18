import type { ReactElement } from "react";
import { teachingWeek, type TeachingDay } from "./formation-calendar";
import { weekdays } from "./shared";
import styles from "./formation.module.css";

const dayLabels = new Map(Object.entries(weekdays));
export function weekdayLabel(day: TeachingDay): string {
  return dayLabels.get(day)!;
}

export function WeekHeader({
  day,
  days = teachingWeek,
}: {
  day: TeachingDay;
  days?: readonly TeachingDay[];
}): ReactElement {
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.hourHead}>
          Hora
        </th>
        {days.map((weekday) => (
          <th key={weekday} scope="col" data-day-selected={weekday === day}>
            {weekdayLabel(weekday)}
            {weekday === "SATURDAY" && <small className={styles.saturday}>até 12h</small>}
          </th>
        ))}
      </tr>
    </thead>
  );
}
