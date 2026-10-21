"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { CalendarPlus, ListFilter } from "lucide-react";
import {
  Button,
  ScheduleCalendar,
  SegmentedControl,
  SegmentedControlItem,
  type ScheduleCalendarProps,
  type SearchSelectOption,
} from "@lazuli/ui";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { trpc } from "~/lib/trpc";
import type { CalendarLesson } from "./calendar-model";
import { lessonCalendarEvents, WeeklyLessonCard } from "./weekly-calendar";
import { lessonFormatLabel } from "./lesson-format";
import { CalendarTeacherFilter } from "./calendar-teacher-filter";
import { CalendarLessonButton } from "./calendar-lesson";
import { CalendarLinkedLesson } from "./calendar-linked-lesson";
import { ClassRecordDialog } from "./class-record-dialog";
import { CalendarExperimentalDialog } from "./calendar-experimental-dialog";
import { CalendarEventFilters, EVENT_TYPES } from "./calendar-event-filters";
import { TeacherAgendaHeader } from "./teacher-agenda-header";
import styles from "./calendar.module.css";

export { CalendarWeek } from "./calendar-week";

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
}: {
  date: string;
  teacherView?: boolean;
  studentFilter?: ReactNode;
  view?: "dia" | "semana";
  onViewChange: (view: "dia" | "semana") => void;
  onSelectDay: (date: string) => void;
  onNavigateDate?: (date: string) => void;
  lessons: CalendarLesson[];
  onSchedule?: (() => void) | undefined;
} & Pick<ScheduleCalendarProps, "status" | "errorMessage" | "onRetry">): ReactElement {
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const experiment = lessons
    .flatMap((lesson) => [
      ...(lesson.experimental ? [lesson.experimental] : []),
      ...(lesson.leadGuests ?? []),
    ])
    .find((visit) => visit.id === experimentId);
  const [types, setTypes] = useState<string[]>(() => EVENT_TYPES.map((type) => type.id));
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState<SearchSelectOption[]>([]);
  const [formats, setFormats] = useState<string[]>(["Presencial", "Online"]);

  const filtered = lessons.filter(
    (lesson) =>
      (types.includes(
        lesson.experimental
          ? lesson.experimental.kind === "PLACEMENT"
            ? "APPOINTMENT"
            : "EXPERIMENTAL"
          : lesson.appointment
            ? "APPOINTMENT"
            : lesson.scheduleType,
      ) ||
        (types.includes("APPOINTMENT") && Boolean(lesson.appointments?.length)) ||
        (types.includes("EXPERIMENTAL") && Boolean(lesson.leadGuests?.length))) &&
      (teachers.length === 0 ||
        teachers.some((teacher) => teacher.id === (lesson.teacherId ?? "unassigned"))) &&
      (lessonFormatLabel(lesson) === null || formats.includes(lessonFormatLabel(lesson)!)),
  );
  const restricted = types.length < EVENT_TYPES.length || teachers.length > 0 || formats.length < 2;
  const openLesson = (lesson: CalendarLesson): void => {
    if (lesson.experimental) setExperimentId(lesson.experimental.id);
    else if (lesson.appointment) setAppointmentId(lesson.appointment.id);
    else setLessonId(lesson.id);
  };
  const filterControls = (
    <CalendarEventFilters
      types={types}
      formats={formats}
      onTypesChange={setTypes}
      onFormatsChange={setFormats}
    />
  );
  return (
    <>
      {teacherView ? (
        <>
          <TeacherAgendaHeader
            date={date}
            view={view}
            onSelectDate={onNavigateDate}
            onViewChange={onViewChange}
            restricted={restricted}
            filters={filterControls}
          />
          {studentFilter}
        </>
      ) : (
        <div className={styles.timelineControls}>
          <CalendarTeacherFilter
            lessons={lessons}
            selected={teachers}
            query={teacherSearch}
            onQueryChange={setTeacherSearch}
            onChange={setTeachers}
          />
          {studentFilter}
          {onSchedule && (
            <Button size="sm" onClick={onSchedule}>
              <CalendarPlus aria-hidden="true" />
              Agendar atendimento
            </Button>
          )}
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">
            {filterControls}
            <SegmentedControl
              size="sm"
              aria-label="Visualização da agenda"
              value={view}
              onValueChange={(value) => {
                if (value === "dia" || value === "semana") onViewChange(value);
              }}
            >
              <SegmentedControlItem value="dia">Dia</SegmentedControlItem>
              <SegmentedControlItem value="semana">Semana</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </div>
      )}
      {restricted && (
        <p className="px-4 pb-3 text-caption text-muted-foreground" role="status">
          Agenda filtrada · horários vazios podem conter compromissos ocultos.
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setTypes(EVENT_TYPES.map((type) => type.id));
              setTeacherSearch("");
              setTeachers([]);
              setFormats(["Presencial", "Online"]);
            }}
          >
            <ListFilter aria-hidden="true" />
            Mostrar tudo
          </Button>
        </p>
      )}
      <ScheduleCalendar
        {...calendarState}
        date={date}
        view={view === "dia" ? "day" : "week"}
        events={lessonCalendarEvents(filtered)}
        onDateChange={onSelectDay}
        onViewChange={(value) => onViewChange(value === "day" ? "dia" : "semana")}
        toolbar={false}
        density={teacherView && view === "semana" ? "compact" : "comfortable"}
        widthBehavior={teacherView ? "fit" : "scroll"}
        expandedEventWidth={teacherView ? 256 : undefined}
        keepExpanded={Boolean(lessonId || appointmentId || experimentId)}
        expandedEventId={
          lessons.find((lesson) => lesson.appointments?.some((item) => item.id === appointmentId))
            ?.id
        }
        onEventActivate={(event) => openLesson(event.lesson)}
        emptyMessage={
          restricted
            ? "Nenhum compromisso com estes filtros. Altere os filtros para consultar os demais."
            : "Nenhum compromisso neste período."
        }
        renderEvent={({ lesson }, context) => {
          if (context.view === "week")
            return (
              <WeeklyLessonCard
                lesson={lesson}
                expanded={context.expanded}
                expandedDayWidth={context.expandedDayWidth}
                expandedWidthShare={context.expandedWidthShare}
                onOpen={context.activate}
              />
            );
          return lesson.appointments?.length || lesson.leadGuests?.length ? (
            <CalendarLinkedLesson
              lesson={lesson}
              expanded={context.expanded}
              appointmentId={appointmentId}
              onToggle={context.toggleExpanded}
              onOpen={openLesson}
              onOpenAppointment={setAppointmentId}
              onOpenExperimental={setExperimentId}
              personal={teacherView}
            />
          ) : (
            <CalendarLessonButton
              lesson={lesson}
              expanded={lesson.appointment?.id === appointmentId}
              onOpen={openLesson}
              personal={teacherView}
            />
          );
        }}
      />
      {lessonId && <ClassRecordDialog id={lessonId} onClose={() => setLessonId(null)} />}
      {experiment && (
        <CalendarExperimentalDialog
          visit={experiment}
          admin={admin}
          onClose={() => setExperimentId(null)}
        />
      )}
      {appointmentId && (
        <StudentAppointmentDialog
          key={appointmentId}
          id={appointmentId}
          admin={admin}
          onSelect={setAppointmentId}
          onClose={() => setAppointmentId(null)}
        />
      )}
    </>
  );
}
