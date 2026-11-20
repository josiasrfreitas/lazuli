import type { CalendarSelection } from "./use-calendar-selection";
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
import { lessonCalendarEvents } from "./calendar-model";
import { WeeklyLessonCard } from "./weekly-lesson-card";
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

type ScheduleProps = CalendarSelection & {
  date: string;
  view: AgendaView;
  teacherView: boolean;
  lessons: CalendarLesson[];
  filtered: CalendarLesson[];
  restricted: boolean;
  onSelectDay: (date: string) => void;
  onViewChange: (view: AgendaView) => void;
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
    target,
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
      keepExpanded={Boolean(target)}
      expandedEventId={
        lessons.find((lesson) =>
          lesson.appointments?.some(
            (item) => target?.kind === "appointment" && item.id === target.id,
          ),
        )?.id
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
  return (
    <CalendarDayLesson
      lesson={lesson}
      context={context}
      selection={props}
      personal={props.teacherView}
      expanded={props.target?.kind === "appointment" && lesson.appointment?.id === props.target.id}
    />
  );
}

export function CalendarDayLesson({
  lesson,
  context,
  selection,
  personal = false,
  expanded,
}: {
  lesson: CalendarLesson;
  context: CalendarEventRenderContext;
  selection: CalendarSelection;
  personal?: boolean;
  expanded: boolean;
}): ReactElement {
  if (lesson.appointments?.length || lesson.leadGuests?.length)
    return (
      <CalendarLinkedLesson
        lesson={lesson}
        expanded={context.expanded}
        appointmentId={selection.target?.kind === "appointment" ? selection.target.id : null}
        onToggle={context.toggleExpanded}
        onOpen={selection.openLesson}
        onOpenAppointment={(id) => selection.setTarget({ kind: "appointment", id })}
        onOpenExperimental={(id) => selection.setTarget({ kind: "experimental", id })}
        personal={personal}
      />
    );
  return (
    <CalendarLessonButton
      lesson={lesson}
      expanded={expanded}
      onOpen={selection.openLesson}
      personal={personal}
    />
  );
}

type DialogsProps = Pick<ScheduleProps, "lessons" | "target" | "setTarget"> & { admin: boolean };
export function CalendarDialogs({
  lessons,
  target,
  admin,
  setTarget,
}: DialogsProps): ReactElement | null {
  if (!target) return null;
  const close = (): void => setTarget(null);
  if (target.kind === "lesson") return <ClassRecordDialog id={target.id} onClose={close} />;
  if (target.kind === "appointment")
    return (
      <StudentAppointmentDialog
        key={target.id}
        id={target.id}
        admin={admin}
        onSelect={(id) => setTarget({ kind: "appointment", id })}
        onClose={close}
      />
    );
  const visit = lessons
    .flatMap((lesson) => [
      ...(lesson.experimental ? [lesson.experimental] : []),
      ...(lesson.leadGuests ?? []),
    ])
    .find((item) => item.id === target.id);
  return visit ? <CalendarExperimentalDialog visit={visit} admin={admin} onClose={close} /> : null;
}
