"use client";

import { EmptyState } from "@lazuli/ui";
import { calendarDate, shiftDate, type CalendarLesson } from "./calendar-model";
import { CalendarLessonCard } from "./calendar-lesson";
import styles from "./calendar.module.css";

function LessonGroup({ lessons }: { lessons: CalendarLesson[] }) {
  return (
    <div className={styles.lessonGroup}>
      {lessons.map((lesson) => (
        <CalendarLessonCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}

export function LessonCalendar({
  from,
  today,
  date,
  mode,
  lessons,
  onSelectDay,
}: {
  from: string;
  today: string;
  date: string;
  mode: string;
  lessons: CalendarLesson[];
  onSelectDay: (date: string) => void;
}) {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(from, index));
  const times = [...new Set(lessons.map((lesson) => lesson.startTime))].sort();
  const dayLessons = lessons.filter((lesson) => lesson.date === date);
  const dayTimes = [...new Set(dayLessons.map((lesson) => lesson.startTime))].sort();
  return (
    <>
      <div className={styles.mobileDays} aria-label="Dias da semana">
        {dates.map((day) => (
          <button
            key={day}
            type="button"
            className={styles.mobileDay}
            data-selected={day === date}
            aria-pressed={day === date}
            onClick={() => onSelectDay(day)}
          >
            <span>{calendarDate(day, { weekday: "short" }).replace(".", "")}</span>
            <strong>{day.slice(-2)}</strong>
            {day === today && <span className={styles.todayDot} aria-label="Hoje" />}
          </button>
        ))}
      </div>
      {mode === "week" && (
        <div className={styles.weekViewport}>
          <table
            className={styles.week}
            aria-label="Calendário semanal de aulas por horário de início"
          >
            <thead>
              <tr>
                <th scope="col" className={styles.timeHeading}>
                  Início
                </th>
                {dates.map((day) => (
                  <th
                    scope="col"
                    key={day}
                    data-today={day === today}
                    data-empty={!lessons.some((lesson) => lesson.date === day)}
                  >
                    <button
                      className={styles.dayHeading}
                      type="button"
                      onClick={() => onSelectDay(day)}
                      aria-label={`Ver aulas de ${calendarDate(day, { weekday: "long", day: "numeric", month: "long" })}`}
                    >
                      <span className={styles.weekday}>
                        {calendarDate(day, { weekday: "short" }).replace(".", "")}
                      </span>
                      <span className={styles.dayNumber}>{day.slice(-2)}</span>
                      <span className={styles.dayCount}>
                        {lessons.filter((lesson) => lesson.date === day).length || ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <th scope="row" className={styles.time}>
                    {time}
                  </th>
                  {dates.map((day) => {
                    const group = lessons.filter(
                      (lesson) => lesson.date === day && lesson.startTime === time,
                    );
                    return (
                      <td key={day} data-today={day === today}>
                        {group.length ? (
                          <LessonGroup key={`${day}-${time}`} lessons={group} />
                        ) : (
                          <span className={styles.emptyCell} aria-label="Sem aulas neste horário">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!times.length && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="Nenhuma aula neste recorte"
                      description="Escolha outra semana para consultar as aulas."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className={mode === "week" ? styles.mobileAgenda : styles.dayAgenda}>
        <div className={styles.dayTitle}>
          <h3>{calendarDate(date, { weekday: "long", day: "numeric", month: "long" })}</h3>
          <span>{dayLessons.length} aulas</span>
        </div>
        {dayTimes.map((time) => (
          <section key={time} className={styles.daySlot} aria-label={`Aulas às ${time}`}>
            <h4 className={styles.time}>{time}</h4>
            <LessonGroup
              key={`${date}-${time}`}
              lessons={dayLessons.filter((lesson) => lesson.startTime === time)}
            />
          </section>
        ))}
        {!dayTimes.length && (
          <EmptyState
            title="Nenhuma aula neste dia"
            description="Escolha outro dia para consultar as aulas."
          />
        )}
      </div>
    </>
  );
}
