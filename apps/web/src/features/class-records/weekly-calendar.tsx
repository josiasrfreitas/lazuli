"use client";
import {
  ScheduleCalendar,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarEventRenderContext,
} from "@lazuli/ui";
import { monday, shiftDate, type CalendarLesson } from "./calendar-model";
import { calendarWallDate } from "./weekly-calendar-model";
import { WeeklyLessonContent, weeklyLessonLabel } from "./weekly-lesson-content";
import { lessonKind } from "./weekly-block-details";
import { useLessonCardReveal } from "./use-lesson-card-reveal";
import styles from "./weekly-calendar.module.css";

export type CalendarSlot = { start: Date; end: Date };
export type WeeklyCalendarSelection = {
  selectedId?: string | undefined;
  loading?: boolean;
  isLessonSelectable: (lesson: CalendarLesson) => boolean;
  isDateDisabled: (date: string) => boolean;
  canSelectSlot?: (slot: CalendarSlot) => boolean;
  onSelectSlot?: (slot: CalendarSlot) => void;
};
export type LessonCalendarEvent = CalendarEvent & { lesson: CalendarLesson };
export function lessonCalendarEvents(lessons: CalendarLesson[]): LessonCalendarEvent[] {
  return lessons.map((lesson) => ({
    id: lesson.id,
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    title: lesson.className,
    subtitle: lesson.teacher ?? "Professor a definir",
    lesson,
  }));
}
export function WeeklyLessonCard({
  lesson,
  expanded,
  expandedDayWidth,
  expandedWidthShare,
  onOpen,
}: {
  lesson: CalendarLesson;
  expanded: boolean;
  expandedDayWidth?: number | undefined;
  expandedWidthShare?: number | undefined;
  onOpen: () => void;
}) {
  const ref = useLessonCardReveal(expandedDayWidth, expandedWidthShare);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.lessonCard}
      aria-haspopup="dialog"
      data-week-trigger
      data-expanded={expanded}
      data-modality={lessonKind(lesson)}
      data-has-markers={!lesson.appointment && !lesson.experimental}
      data-cancelled={lesson.state === "CANCELLED"}
      aria-label={weeklyLessonLabel(lesson)}
      title={weeklyLessonLabel(lesson)}
      onClick={onOpen}
    >
      <WeeklyLessonContent lesson={lesson} />
    </button>
  );
}

/** Domain adapter; both the agenda and scheduling now use the Design System grid. */
export function WeeklyCalendar({
  date,
  lessons,
  onOpen,
  onSelectDay,
  keepExpanded,
  selection,
}: {
  date: string;
  lessons: CalendarLesson[];
  onOpen: (lesson: CalendarLesson) => void;
  onSelectDay: (date: string) => void;
  keepExpanded: boolean;
  selection?: WeeklyCalendarSelection;
}) {
  const events = lessonCalendarEvents(lessons).map((event) => ({
    ...event,
    disabled: selection ? !selection.isLessonSelectable(event.lesson) : false,
  }));
  const slot = (range: CalendarInterval) => ({
    start: calendarWallDate(range.date, range.startTime),
    end: calendarWallDate(range.date, range.endTime),
  });
  const blocked = selection
    ? Array.from({ length: 7 }, (_, day) => shiftDate(monday(date), day))
        .filter(selection.isDateDisabled)
        .map((day) => ({
          id: day,
          date: day,
          startTime: "00:00",
          endTime: "24:00",
          label: "Dia indisponível",
        }))
    : [];
  return (
    <ScheduleCalendar
      date={date}
      view="week"
      events={events}
      onDateChange={onSelectDay}
      onViewChange={() => undefined}
      toolbar={false}
      density={selection ? "compact" : "comfortable"}
      keepExpanded={keepExpanded}
      selectedEventId={selection?.selectedId}
      status={selection?.loading ? "loading" : "ready"}
      onEventActivate={(event) => onOpen(event.lesson)}
      {...(!selection
        ? {
            renderEvent: (event: LessonCalendarEvent, context: CalendarEventRenderContext) => (
              <WeeklyLessonCard
                lesson={event.lesson}
                expanded={context.expanded}
                expandedDayWidth={context.expandedDayWidth}
                expandedWidthShare={context.expandedWidthShare}
                onOpen={context.activate}
              />
            ),
          }
        : {})}
      rangeSelection={
        selection?.onSelectSlot
          ? {
              controls: <></>,
              blocked,
              getError: (range) =>
                selection.canSelectSlot?.(slot(range)) ? undefined : "Horário indisponível.",
              onSelect: (range) => selection.onSelectSlot?.(slot(range)),
            }
          : undefined
      }
    />
  );
}
