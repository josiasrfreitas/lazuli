import type { ReactElement } from "react";
import { CalendarDays } from "lucide-react";
import { type ScheduleSlot, formatClassScheduleTime } from "./labels";
import styles from "./class-page.module.css";

const DAYS = [
  ["MONDAY", "Segunda"],
  ["TUESDAY", "Terça"],
  ["WEDNESDAY", "Quarta"],
  ["THURSDAY", "Quinta"],
  ["FRIDAY", "Sexta"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"],
] as const;

export function ClassSchedule({ slots }: { slots: readonly ScheduleSlot[] }): ReactElement {
  return (
    <section aria-labelledby="class-schedule-title" className="min-w-0">
      <div className="flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-4 text-icon" />
        <h2 id="class-schedule-title" className="text-caption text-muted-foreground">
          Horários
        </h2>
      </div>
      {slots.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nenhum horário cadastrado.</p>
      ) : (
        <ul className={styles.scheduleDays}>
          {DAYS.map(([weekday, label]) => {
            const meetings = slots
              .filter((slot) => slot.weekday === weekday)
              .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
            if (meetings.length === 0) return null;
            return (
              <li key={weekday} className="min-w-0">
                <p className={styles.scheduleDay}>{label}</p>
                {meetings.map((slot) => (
                  <p key={slot.startTime.toISOString()} className={styles.scheduleTime}>
                    {formatClassScheduleTime([slot]).replace(/^\S+ /u, "")}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
