"use client";

import type { ReactElement, ReactNode } from "react";
import type { ScheduleCalendarProps } from "@lazuli/ui";
import { useLessonCalendarModel } from "./use-lesson-calendar";
import type { CalendarLesson } from "./calendar-model";
import { CalendarEventFilters } from "./calendar-event-filters";
import {
  CalendarControls,
  CalendarDialogs,
  LessonCalendarSchedule,
  RestrictedNotice,
} from "./calendar-view";

type Props = {
  date: string;
  teacherView?: boolean;
  studentFilter?: ReactNode;
  view?: "dia" | "semana";
  onViewChange: (view: "dia" | "semana") => void;
  onSelectDay: (date: string) => void;
  onNavigateDate?: (date: string) => void;
  lessons: CalendarLesson[];
  onSchedule?: (() => void) | undefined;
} & Pick<ScheduleCalendarProps, "status" | "errorMessage" | "onRetry">;

export function LessonCalendar({
  date,
  lessons,
  onSchedule,
  view = "dia",
  onViewChange,
  onSelectDay,
  onNavigateDate = onSelectDay,
  studentFilter,
  teacherView = false,
  ...calendarState
}: Props): ReactElement {
  const model = useLessonCalendarModel(lessons);
  const filterControls = (
    <CalendarEventFilters
      types={model.types}
      formats={model.formats}
      onTypesChange={model.setTypes}
      onFormatsChange={model.setFormats}
    />
  );
  return (
    <>
      <CalendarControls
        date={date}
        view={view}
        teacherView={teacherView}
        lessons={lessons}
        onNavigateDate={onNavigateDate}
        onViewChange={onViewChange}
        onSchedule={onSchedule}
        studentFilter={studentFilter}
        filterControls={filterControls}
        restricted={model.restricted}
        teachers={model.teachers}
        teacherSearch={model.teacherSearch}
        setTeachers={model.setTeachers}
        setTeacherSearch={model.setTeacherSearch}
      />
      <RestrictedNotice restricted={model.restricted} reset={model.resetFilters} />
      <LessonCalendarSchedule
        date={date}
        view={view}
        teacherView={teacherView}
        lessons={lessons}
        filtered={model.filtered}
        restricted={model.restricted}
        target={model.target}
        onSelectDay={onSelectDay}
        onViewChange={onViewChange}
        openLesson={model.openLesson}
        setTarget={model.setTarget}
        calendarState={calendarState}
      />
      <CalendarDialogs
        lessons={lessons}
        target={model.target}
        setTarget={model.setTarget}
        admin={model.admin}
      />
    </>
  );
}
