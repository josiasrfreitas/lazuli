import type { ReactElement, ReactNode } from "react";
import { CalendarPlus, ListFilter } from "lucide-react";
import {
  Button,
  ScheduleCalendar,
  SegmentedControl,
  SegmentedControlItem,
  type ScheduleCalendarProps,
  type CalendarEventRenderContext,
  type SearchSelectOption,
} from "@lazuli/ui";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import type { CalendarLesson } from "./calendar-model";
import { lessonCalendarEvents, WeeklyLessonCard } from "./weekly-calendar";
import { CalendarTeacherFilter } from "./calendar-teacher-filter";
import { CalendarLessonButton } from "./calendar-lesson";
import { CalendarLinkedLesson } from "./calendar-linked-lesson";
import { ClassRecordDialog } from "./class-record-dialog";
import { CalendarExperimentalDialog } from "./calendar-experimental-dialog";
import { TeacherAgendaHeader } from "./teacher-agenda-header";
import styles from "./calendar.module.css";

const EXPANDED_TEACHER_EVENT_WIDTH = 256;
export type AgendaView = "dia" | "semana";
export type CalendarControlsProps = {
  date: string;
  view: AgendaView;
  teacherView: boolean;
  lessons: CalendarLesson[];
  onNavigateDate: (date: string) => void;
  onViewChange: (view: AgendaView) => void;
  onSchedule?: (() => void) | undefined;
  studentFilter?: ReactNode;
  filterControls: ReactNode;
  restricted: boolean;
  teachers: SearchSelectOption[];
  teacherSearch: string;
  setTeachers: (teachers: SearchSelectOption[]) => void;
  setTeacherSearch: (search: string) => void;
};
export function CalendarControls(props: CalendarControlsProps): ReactElement {
  if (props.teacherView)
    return (
      <>
        <TeacherAgendaHeader
          date={props.date}
          view={props.view}
          onSelectDate={props.onNavigateDate}
          onViewChange={props.onViewChange}
          restricted={props.restricted}
          filters={props.filterControls}
        />
        {props.studentFilter}
      </>
    );
  return <AdminCalendarControls {...props} />;
}

function AdminCalendarControls({
  lessons,
  teachers,
  teacherSearch,
  setTeachers,
  setTeacherSearch,
  studentFilter,
  onSchedule,
  filterControls,
  view,
  onViewChange,
}: CalendarControlsProps): ReactElement {
  return (
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
  );
}

export function RestrictedNotice({
  restricted,
  reset,
}: {
  restricted: boolean;
  reset: () => void;
}): ReactElement | null {
  if (!restricted) return null;
  return (
    <p className="px-4 pb-3 text-caption text-muted-foreground" role="status">
      Agenda filtrada · horários vazios podem conter compromissos ocultos.
      <Button variant="text" size="sm" onClick={reset}>
        <ListFilter aria-hidden="true" />
        Mostrar tudo
      </Button>
    </p>
  );
}

type ScheduleProps = {
  date: string;
  view: AgendaView;
  teacherView: boolean;
  lessons: CalendarLesson[];
  filtered: CalendarLesson[];
  restricted: boolean;
  lessonId: string | null;
  appointmentId: string | null;
  experimentId: string | null;
  onSelectDay: (date: string) => void;
  onViewChange: (view: AgendaView) => void;
  openLesson: (lesson: CalendarLesson) => void;
  setAppointmentId: (id: string | null) => void;
  setExperimentId: (id: string | null) => void;
  calendarState: Pick<ScheduleCalendarProps, "status" | "errorMessage" | "onRetry">;
};
export function LessonCalendarSchedule(props: ScheduleProps): ReactElement {
  const {
    date,
    view,
    teacherView,
    filtered,
    restricted,
    lessons,
    lessonId,
    appointmentId,
    experimentId,
    onSelectDay,
    onViewChange,
    openLesson,
    calendarState,
  } = props;
  return (
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
      expandedEventWidth={teacherView ? EXPANDED_TEACHER_EVENT_WIDTH : undefined}
      keepExpanded={Boolean(lessonId || appointmentId || experimentId)}
      expandedEventId={
        lessons.find((lesson) => lesson.appointments?.some((item) => item.id === appointmentId))?.id
      }
      onEventActivate={(event) => openLesson(event.lesson)}
      emptyMessage={
        restricted
          ? "Nenhum compromisso com estes filtros. Altere os filtros para consultar os demais."
          : "Nenhum compromisso neste período."
      }
      renderEvent={({ lesson }, context) => renderLessonEvent({ lesson, context }, props)}
    />
  );
}

function renderLessonEvent(
  {
    lesson,
    context,
  }: {
    lesson: CalendarLesson;
    context: CalendarEventRenderContext;
  },
  props: ScheduleProps,
): ReactElement {
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
  if (lesson.appointments?.length || lesson.leadGuests?.length)
    return (
      <CalendarLinkedLesson
        lesson={lesson}
        expanded={context.expanded}
        appointmentId={props.appointmentId}
        onToggle={context.toggleExpanded}
        onOpen={props.openLesson}
        onOpenAppointment={props.setAppointmentId}
        onOpenExperimental={props.setExperimentId}
        personal={props.teacherView}
      />
    );
  return (
    <CalendarLessonButton
      lesson={lesson}
      expanded={lesson.appointment?.id === props.appointmentId}
      onOpen={props.openLesson}
      personal={props.teacherView}
    />
  );
}

type DialogsProps = {
  lessons: CalendarLesson[];
  lessonId: string | null;
  appointmentId: string | null;
  experimentId: string | null;
  admin: boolean;
  setLessonId: (id: string | null) => void;
  setAppointmentId: (id: string | null) => void;
  setExperimentId: (id: string | null) => void;
};
export function CalendarDialogs({
  lessons,
  lessonId,
  appointmentId,
  experimentId,
  admin,
  setLessonId,
  setAppointmentId,
  setExperimentId,
}: DialogsProps): ReactElement {
  const experiment = lessons
    .flatMap((lesson) => [
      ...(lesson.experimental ? [lesson.experimental] : []),
      ...(lesson.leadGuests ?? []),
    ])
    .find((visit) => visit.id === experimentId);
  return (
    <>
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
