import type { ReactElement } from "react";
import { CalendarDays } from "lucide-react";
import { type ScheduleSlot, formatClassScheduleTime } from "./labels";

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
        <ul className="mt-3.5 flex flex-wrap gap-x-8 gap-y-4">
          {DAYS.map(([weekday, label]) => {
            const meetings = slots
              .filter((slot) => slot.weekday === weekday)
              .toSorted((left, right) => left.startTime.getTime() - right.startTime.getTime());
            if (meetings.length === 0) return null;
            return (
              <li key={weekday} className="min-w-0">
                <p className="font-display text-2xl font-medium text-heading">{label}</p>
                {meetings.map((slot) => (
                  <p
                    key={slot.startTime.toISOString()}
                    className="mt-1.5 whitespace-nowrap font-numeric text-base text-foreground"
                  >
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
