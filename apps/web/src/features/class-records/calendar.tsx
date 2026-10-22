"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { type ScheduleCalendarProps, type SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { CalendarLesson } from "./calendar-model";
import { CalendarEventFilters, EVENT_TYPES } from "./calendar-event-filters";
import { filterLessons, filtersRestricted } from "./calendar-filter";
import {
  CalendarControls,
  CalendarDialogs,
  LessonCalendarSchedule,
  RestrictedNotice,
} from "./calendar-view";

export { CalendarWeek } from "./calendar-week";

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

type Model = {
  admin: boolean;
  lessonId: string | null;
  appointmentId: string | null;
  experimentId: string | null;
  setLessonId: (id: string | null) => void;
  setAppointmentId: (id: string | null) => void;
  setExperimentId: (id: string | null) => void;
  types: string[];
  setTypes: (types: string[]) => void;
  teacherSearch: string;
  setTeacherSearch: (search: string) => void;
  teachers: SearchSelectOption[];
  setTeachers: (teachers: SearchSelectOption[]) => void;
  formats: string[];
  setFormats: (formats: string[]) => void;
  filtered: CalendarLesson[];
  restricted: boolean;
  openLesson: (lesson: CalendarLesson) => void;
  resetFilters: () => void;
};

export function LessonCalendar(props: Props): ReactElement {
  const model = useLessonCalendarModel(props.lessons);
  return <CalendarContent {...props} model={model} />;
}

function useLessonCalendarModel(lessons: CalendarLesson[]): Model {
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [types, setTypes] = useState<string[]>(() => EVENT_TYPES.map((type) => type.id));
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState<SearchSelectOption[]>([]);
  const [formats, setFormats] = useState<string[]>(["Presencial", "Online"]);
  const filters = { types, teachers, formats };
  const filtered = filterLessons(lessons, filters);
  const restricted = filtersRestricted(filters);
  function openLesson(lesson: CalendarLesson): void {
    if (lesson.experimental) setExperimentId(lesson.experimental.id);
    else if (lesson.appointment) setAppointmentId(lesson.appointment.id);
    else setLessonId(lesson.id);
  }
  function resetFilters(): void {
    setTypes(EVENT_TYPES.map((type) => type.id));
    setTeacherSearch("");
    setTeachers([]);
    setFormats(["Presencial", "Online"]);
  }
  return {
    admin,
    lessonId,
    appointmentId,
    experimentId,
    setLessonId,
    setAppointmentId,
    setExperimentId,
    types,
    setTypes,
    teacherSearch,
    setTeacherSearch,
    teachers,
    setTeachers,
    formats,
    setFormats,
    filtered,
    restricted,
    openLesson,
    resetFilters,
  };
}

function CalendarContent({
  model,
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
}: Props & { model: Model }): ReactElement {
  const normalized = {
    date,
    lessons,
    onSchedule,
    view,
    onViewChange,
    onSelectDay,
    onNavigateDate,
    studentFilter,
    teacherView,
  };
  return (
    <>
      <CalendarToolbar {...normalized} model={model} />
      <LessonCalendarSchedule {...scheduleProps({ props: normalized, model, calendarState })} />
      <CalendarDialogs
        lessons={lessons}
        lessonId={model.lessonId}
        appointmentId={model.appointmentId}
        experimentId={model.experimentId}
        admin={model.admin}
        setLessonId={model.setLessonId}
        setAppointmentId={model.setAppointmentId}
        setExperimentId={model.setExperimentId}
      />
    </>
  );
}

type NormalizedProps = Required<
  Pick<
    Props,
    "date" | "lessons" | "view" | "teacherView" | "onViewChange" | "onSelectDay" | "onNavigateDate"
  >
> &
  Pick<Props, "onSchedule" | "studentFilter">;

function CalendarToolbar({
  model,
  date,
  lessons,
  onSchedule,
  view,
  onViewChange,
  onNavigateDate,
  studentFilter,
  teacherView,
}: NormalizedProps & { model: Model }): ReactElement {
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
    </>
  );
}

function scheduleProps({
  props,
  model,
  calendarState,
}: {
  props: NormalizedProps;
  model: Model;
  calendarState: Pick<ScheduleCalendarProps, "status" | "errorMessage" | "onRetry">;
}): Parameters<typeof LessonCalendarSchedule>[0] {
  return {
    date: props.date,
    view: props.view,
    teacherView: props.teacherView,
    lessons: props.lessons,
    filtered: model.filtered,
    restricted: model.restricted,
    lessonId: model.lessonId,
    appointmentId: model.appointmentId,
    experimentId: model.experimentId,
    onSelectDay: props.onSelectDay,
    onViewChange: props.onViewChange,
    openLesson: model.openLesson,
    setAppointmentId: model.setAppointmentId,
    setExperimentId: model.setExperimentId,
    calendarState,
  };
}
