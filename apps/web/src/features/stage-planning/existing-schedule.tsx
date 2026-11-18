import type { ReactElement } from "react";
import { CalendarDays } from "lucide-react";
import type { Planning } from "./shared";
import { dateLabel } from "./shared";
import styles from "./adjustments.module.css";

export const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function scheduledDays(
  data: Planning,
  from: string,
  through: string,
): Planning["availableSessions"] {
  return data.availableSessions.filter(
    (session) => session.date >= from && session.date <= through,
  );
}
export function ExistingSchedule({
  sessions,
}: {
  sessions: Planning["availableSessions"];
}): ReactElement {
  if (sessions.some((session) => !session.startTime || !session.endTime)) {
    return (
      <p role="status" className={styles.existingSchedule}>
        Carregando horários da turma…
      </p>
    );
  }
  const groups = new Map<string, { days: Set<number>; dates: string[] }>();
  for (const session of sessions) {
    const time = `${session.startTime}–${session.endTime}`;
    const group = groups.get(time) ?? { days: new Set<number>(), dates: [] };
    group.days.add(new Date(`${session.date}T12:00:00Z`).getUTCDay());
    group.dates.push(session.date);
    groups.set(time, group);
  }
  return (
    <div id="existing-class-schedule" className={styles.existingSchedule}>
      <p>
        <CalendarDays size={15} aria-hidden="true" />
        Já tem aula neste intervalo
      </p>
      {groups.size ? (
        <ul>
          {[...groups.entries()].map(([time, group]) => (
            <li key={time} title={[...new Set(group.dates)].map(dateLabel).join(" · ")}>
              <strong>
                {[...group.days]
                  .sort((a, b) => a - b)
                  .map((day) => weekLabels[day])
                  .join(" e ")}
              </strong>
              <span>{time}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span>Nenhuma aula agendada nas datas escolhidas.</span>
      )}
      {groups.size > 0 && <span>Você pode adicionar outro horário nesses dias.</span>}
    </div>
  );
}
