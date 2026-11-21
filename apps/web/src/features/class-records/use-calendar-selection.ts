import { useState } from "react";
import type { CalendarLesson } from "./calendar-model";

export type CalendarTarget = { kind: "lesson" | "appointment" | "experimental"; id: string };

export type CalendarSelection = {
  target: CalendarTarget | null;
  setTarget: (target: CalendarTarget | null) => void;
  openLesson: (lesson: CalendarLesson) => void;
};

export function useCalendarSelection(): CalendarSelection {
  const [target, setTarget] = useState<CalendarTarget | null>(null);
  function openLesson(lesson: CalendarLesson): void {
    if (lesson.experimental) setTarget({ kind: "experimental", id: lesson.experimental.id });
    else if (lesson.appointment) setTarget({ kind: "appointment", id: lesson.appointment.id });
    else setTarget({ kind: "lesson", id: lesson.id });
  }
  return { target, setTarget, openLesson };
}
