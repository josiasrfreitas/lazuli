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
    <section aria-labelledby="class-schedule-title" className="min-w-0 border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="class-schedule-title" className="text-body font-semibold">
          Agenda da turma
        </h2>
      </div>
      {slots.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nenhum horário cadastrado.</p>
      ) : (
        <ul className="space-y-3">
          {DAYS.map(([weekday, label]) => {
            const meetings = slots.filter((slot) => slot.weekday === weekday);
            if (meetings.length === 0) return null;
            return (
              <li key={weekday} className="border-l-2 border-border-strong pl-3">
                <p className="text-caption text-muted-foreground">{label}</p>
                {meetings.map((slot) => (
                  <p
                    key={slot.startTime.toISOString()}
                    className="mt-0.5 whitespace-nowrap font-numeric text-body tabular-nums"
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
