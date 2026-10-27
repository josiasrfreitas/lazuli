"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
  type RefObject,
} from "react";
import {
  Field,
  Label,
  getScheduleCalendarRange,
  SegmentedControl,
  SegmentedControlItem,
  type CalendarBlockedInterval,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
  type SearchSelectOption,
  type ScheduleCalendarProps,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { TimeField } from "~/features/shared/time-field";
import { MeetingDateField } from "./form-fields";
import { ScheduleCalendarToolbar } from "./schedule-calendar-toolbar";
import styles from "./class-meeting-step.module.css";
import { AppointmentCalendar } from "./appointment-calendar";

const CLOCK_REFRESH_INTERVAL_MS = 30_000;
const DEFAULT_APPOINTMENT_MINUTES = 60;

export type ScheduleSelection = CalendarInterval & {
  sessionId?: string | undefined;
  format?: "IN_PERSON" | "ONLINE" | undefined;
};
type MeetingEvent = CalendarEvent & {
  sessionId?: string | undefined;
  format?: "IN_PERSON" | "ONLINE" | undefined;
};
type Props = {
  actions?: ReactNode;
  durationMinutes?: number;
  kind: "CLASS" | "INDEPENDENT";
  studentId: string;
  previousId?: string | undefined;
  teacher: SearchSelectOption | null;
  onTeacherChange: (value: SearchSelectOption | null) => void;
  date: string;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
  sessionId: string;
  onDateChange: (date: string) => void;
  onSelect: (value: ScheduleSelection) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onFormatChange: (value: "IN_PERSON" | "ONLINE") => void;
  onReadyChange: (ready: boolean) => void;
  error?: string | undefined;
};
function schoolClock(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (key: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === key)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}
function overlaps(left: CalendarInterval, right: CalendarInterval): boolean {
  return (
    left.date === right.date && left.startTime < right.endTime && right.startTime < left.endTime
  );
}
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
type Availability = RouterOutputs["appointments"]["availability"];
type IntervalContext = {
  data: Availability | undefined;
  teacher: SearchSelectOption | null;
  visibleRange: ReturnType<typeof getScheduleCalendarRange>;
  now: { date: string; time: string };
  blocked: CalendarBlockedInterval[];
  forClass?: boolean;
  dateDraft?: string;
};

function intervalTimeError(
  range: CalendarInterval,
  now: IntervalContext["now"],
): string | undefined {
  if (!clock.test(range.startTime) || !clock.test(range.endTime))
    return "Informe início e fim em hh:mm.";
  if (range.endTime <= range.startTime) return "O fim deve ser depois do início.";
  if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
    return "Escolha um horário que ainda não começou.";
  return undefined;
}

function intervalError(range: CalendarInterval, context: IntervalContext): string | undefined {
  const timeError = intervalTimeError(range, context.now);
  if (timeError) return timeError;
  const { data, teacher, visibleRange, blocked } = context;
  if (!data || !teacher || range.date < visibleRange.from || range.date > visibleRange.through)
    return "Consulte a disponibilidade do período selecionado.";
  const closed = data.closedDays.find((row) => row.date === range.date);
  if (closed) return `Escola fechada: ${closed.reason}.`;
  const conflicts = context.forClass ? [...data.teacherBusy, ...data.studentBusy] : blocked;
  const conflict = conflicts.find((item) => overlaps(range, item));
  if (conflict) return `${conflict.label} · ${conflict.startTime}–${conflict.endTime}.`;
  return undefined;
}

function selectedIntervalError(props: Props, context: IntervalContext): string | undefined {
  if (props.kind !== "INDEPENDENT") return undefined;
  if (context.dateDraft !== formatDateOnlyBR(props.date)) return "Informe uma data válida.";
  if (!props.startTime || !props.endTime) return undefined;
  return intervalError(
    { date: props.date, startTime: props.startTime, endTime: props.endTime },
    context,
  );
}

type FooterProps = {
  props: Props;
  now: IntervalContext["now"];
  dateDraft: string;
  setDateDraft: (value: string) => void;
  visibleRange: IntervalContext["visibleRange"];
  setCalendarDate: (date: string) => void;
  selectedClass: Availability["classes"][number] | undefined;
};

function MeetingDateSelector({
  props,
  now,
  dateDraft,
  setDateDraft,
  visibleRange,
  setCalendarDate,
}: FooterProps): ReactElement {
  return (
    <MeetingDateField
      compact
      fluid
      minDate={now.date}
      value={dateDraft}
      onChange={(value) => {
        setDateDraft(value);
        const parsed = parseDateBR(value);
        if (parsed) {
          props.onDateChange(parsed);
          if (parsed < visibleRange.from || parsed > visibleRange.through) setCalendarDate(parsed);
        }
      }}
    />
  );
}

function MeetingTimeFields({ props }: { props: Props }): ReactElement {
  return (
    <>
      <TimeField
        name="appointment-start"
        label="Início"
        placeholder="hh:mm"
        align="center"
        value={props.startTime}
        onChange={props.onStartChange}
      />
      <TimeField
        name="appointment-end"
        label="Fim"
        placeholder="hh:mm"
        align="center"
        value={props.endTime}
        onChange={props.onEndChange}
      />
    </>
  );
}

function MeetingFormatSelector({ props }: { props: Props }): ReactElement {
  return (
    <div className={styles.format}>
      <Field>
        <Label id="appointment-format-label">Formato</Label>
        <SegmentedControl
          size="sm"
          aria-labelledby="appointment-format-label"
          value={props.format}
          onValueChange={(value) => {
            if (value === "IN_PERSON" || value === "ONLINE") props.onFormatChange(value);
          }}
        >
          <SegmentedControlItem value="IN_PERSON">Presencial</SegmentedControlItem>
          <SegmentedControlItem value="ONLINE">Online</SegmentedControlItem>
        </SegmentedControl>
      </Field>
    </div>
  );
}

function IndependentSelection(footer: FooterProps): ReactElement {
  return (
    <div className={styles.selection} aria-label="Horário do atendimento">
      <MeetingDateSelector {...footer} />
      <MeetingTimeFields props={footer.props} />
      <MeetingFormatSelector props={footer.props} />
    </div>
  );
}

function ClassSelection({ selectedClass }: Pick<FooterProps, "selectedClass">): ReactElement {
  return (
    <div className={styles.summary} aria-live="polite">
      {selectedClass ? (
        <>
          <strong>{selectedClass.className}</strong>
          <span>
            {formatDateOnlyBR(selectedClass.date)} · {selectedClass.startTime}–
            {selectedClass.endTime} · {selectedClass.format === "ONLINE" ? "Online" : "Presencial"}
          </span>
        </>
      ) : (
        <p className="text-muted-foreground">Selecione uma aula na agenda.</p>
      )}
    </div>
  );
}

function MeetingFooter(footer: FooterProps): ReactElement {
  return (
    <div className={styles.footer}>
      {footer.props.kind === "INDEPENDENT" ? (
        <IndependentSelection {...footer} />
      ) : (
        <ClassSelection selectedClass={footer.selectedClass} />
      )}
      <div className={styles.actions}>{footer.props.actions}</div>
    </div>
  );
}

type ClockModel = {
  step: RefObject<HTMLDivElement | null>;
  now: { date: string; time: string };
  dateDraft: string;
  setDateDraft: (value: string) => void;
  setCalendarDate: (date: string) => void;
  view: CalendarView;
  setView: (view: CalendarView) => void;
  visibleRange: IntervalContext["visibleRange"];
  visibleDate: string;
  navigate: (date: string) => void;
};
type AvailabilityQuery = {
  data: Availability | undefined;
  isSuccess: boolean;
  isFetching: boolean;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};
type MeetingSelection = {
  selectedClass: Availability["classes"][number] | undefined;
  selectedRange: CalendarInterval;
  manualError: string | undefined;
  status: "loading" | "error" | "ready";
};
type SelectionInput = {
  props: Props;
  clock: ClockModel;
  query: AvailabilityQuery;
  context: IntervalContext;
};
type MeetingModel = SelectionInput & {
  events: MeetingEvent[];
  selection: MeetingSelection;
};
type RangeSelection = NonNullable<ScheduleCalendarProps<MeetingEvent>["rangeSelection"]>;

function useMeetingClock(props: Props): ClockModel {
  const step = useRef<HTMLDivElement>(null);
  const [calendarDate, setCalendarDate] = useState(props.date);
  const [view, setView] = useState<CalendarView>("week");
  const [dateDraft, setDateDraft] = useState(formatDateOnlyBR(props.date));
  const [now, setNow] = useState(schoolClock);
  useEffect(() => setDateDraft(formatDateOnlyBR(props.date)), [props.date]);
  useEffect(() => step.current?.focus(), []);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(schoolClock()), CLOCK_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(timer);
  }, []);
  const visibleRange = getScheduleCalendarRange({
    date: calendarDate,
    view,
    dayCount: 7,
    minDate: now.date,
  });
  const visibleDate = calendarDate.localeCompare(now.date) < 0 ? now.date : calendarDate;
  function navigate(date: string): void {
    const next = date < now.date ? now.date : date;
    setCalendarDate(next);
    props.onDateChange(next);
  }
  return {
    step,
    now,
    dateDraft,
    setDateDraft,
    setCalendarDate,
    view,
    setView,
    visibleRange,
    visibleDate,
    navigate,
  };
}

function useMeetingAvailability(props: Props, clock: ClockModel): AvailabilityQuery {
  return trpc.appointments.availability.useQuery(
    {
      teacherId: props.teacher?.id ?? "00000000-0000-0000-0000-000000000000",
      studentId: props.studentId,
      week: clock.visibleRange.from,
      through: clock.visibleRange.through,
      ...(props.previousId ? { excludeAppointmentId: props.previousId } : {}),
    },
    {
      enabled: Boolean(props.teacher && props.studentId),
      retry: false,
      refetchOnWindowFocus: true,
    },
  );
}

function meetingBlocked(data: Availability | undefined): CalendarBlockedInterval[] {
  return [
    ...(data?.classes ?? []).map((row) => ({
      id: "class-" + row.id,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      label: "Aula · " + row.className,
    })),
    ...(data?.teacherBusy ?? []).map((row) => ({ ...row, id: "teacher-" + row.id })),
    ...(data?.studentBusy ?? []).map((row) => ({ ...row, id: "student-" + row.id })),
  ];
}

function meetingEvents(
  data: Availability | undefined,
  { context, kind }: { context: IntervalContext; kind: Props["kind"] },
): MeetingEvent[] {
  return [
    ...(data?.classes ?? []).map((row): MeetingEvent => {
      const range = { date: row.date, startTime: row.startTime, endTime: row.endTime };
      const invalid = intervalError(range, { ...context, forClass: true });
      const reason = row.selectable ? invalid : "Aula ainda não preparada para agendamento.";
      return {
        ...range,
        id: "class-" + row.id,
        sessionId: row.sessionId ?? undefined,
        format: row.format,
        title: row.className,
        subtitle: [row.stageName || null, row.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"]
          .filter(Boolean)
          .join(" · "),
        description: [row.format === "ONLINE" ? "Online" : "Presencial", reason]
          .filter(Boolean)
          .join(" · "),
        tone: row.selectable && !invalid ? "accent" : "neutral",
        disabled: kind !== "CLASS" || Boolean(reason),
        ...(reason ? { disabledReason: reason } : {}),
      };
    }),
    ...(data?.teacherBusy ?? []).map((row): MeetingEvent => ({
      ...row,
      id: "busy-" + row.id,
      title: row.label,
      disabled: true,
    })),
  ];
}

function meetingReady({
  props,
  query,
  currentClass,
  manualError,
}: SelectionInput & {
  currentClass: boolean;
  manualError: string | undefined;
}): boolean {
  if (!query.isSuccess || query.isFetching) return false;
  if (props.kind === "CLASS") return currentClass;
  return Boolean(props.teacher && props.startTime && props.endTime && !manualError);
}

function useMeetingSelection({ props, clock, query, context }: SelectionInput): MeetingSelection {
  const selectedClass = query.data?.classes.find((row) => row.sessionId === props.sessionId);
  const selectedRange = { date: props.date, startTime: props.startTime, endTime: props.endTime };
  const currentClass = Boolean(
    selectedClass &&
    selectedClass.selectable &&
    !intervalError(selectedClass, { ...context, forClass: true }),
  );
  const manualError = selectedIntervalError(props, { ...context, dateDraft: clock.dateDraft });
  const ready = meetingReady({ props, clock, query, context, currentClass, manualError });
  useEffect(() => props.onReadyChange(ready), [ready, props.onReadyChange]);
  let status: MeetingSelection["status"] = "ready";
  if (!props.teacher || query.isFetching || query.isPending) status = "loading";
  else if (query.isError) status = "error";
  return { selectedClass, selectedRange, manualError, status };
}

function selectMeetingEvent(event: MeetingEvent, props: Props): void {
  if (props.kind !== "CLASS" || !event.sessionId) return;
  props.onSelect({
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    sessionId: event.sessionId,
    format: event.format,
  });
}

function meetingRangeSelection({
  props,
  clock,
  context,
  selection,
}: MeetingModel): RangeSelection | undefined {
  if (props.kind !== "INDEPENDENT") return undefined;
  return {
    clickDurationMinutes: props.durationMinutes || DEFAULT_APPOINTMENT_MINUTES,
    value:
      props.startTime && props.endTime && !selection.manualError ? selection.selectedRange : null,
    minimum: clock.now,
    blocked: context.blocked,
    getError: (range) => intervalError(range, context),
    onSelect: (range) => props.onSelect(range),
    controls: <></>,
  };
}

function MeetingCalendar(model: MeetingModel): ReactElement {
  const { props, clock, query, events, selection } = model;
  const rangeSelection = meetingRangeSelection(model);
  return (
    <div className={styles.calendar}>
      <AppointmentCalendar<MeetingEvent>
        collapseEmptyShifts={props.kind === "CLASS"}
        toolbar={false}
        date={clock.visibleDate}
        view={clock.view}
        dayCount={7}
        minDate={clock.now.date}
        density="compact"
        expandEvents={false}
        label="Disponibilidade para atendimento"
        events={events}
        status={selection.status}
        errorMessage="Não foi possível consultar a disponibilidade. Tente novamente."
        onRetry={() => void query.refetch()}
        onDateChange={clock.navigate}
        onViewChange={clock.setView}
        selectedEventId={
          props.kind === "CLASS" && props.sessionId
            ? "class-" + selection.selectedClass?.id
            : undefined
        }
        onEventActivate={(event) => selectMeetingEvent(event, props)}
        emptyMessage={
          props.kind === "CLASS"
            ? "Nenhuma aula deste professor neste período."
            : "Período livre. Escolha um horário na agenda."
        }
        rangeSelection={rangeSelection}
      />
    </div>
  );
}

function MeetingContent(model: MeetingModel): ReactElement {
  const { props, clock, selection } = model;
  return (
    <div
      ref={clock.step}
      tabIndex={-1}
      role="group"
      aria-label={props.kind === "CLASS" ? "Selecione uma aula" : "Selecione um horário livre"}
      className={styles.layout}
    >
      <ScheduleCalendarToolbar
        date={clock.visibleDate}
        today={clock.now.date}
        view={clock.view}
        teacher={props.teacher}
        onTeacherChange={props.onTeacherChange}
        onDateChange={clock.navigate}
        onViewChange={clock.setView}
      />
      {!props.teacher && (
        <p role="status" className="text-sm text-muted-foreground">
          Selecione um professor para consultar a agenda.
        </p>
      )}
      <MeetingCalendar {...model} />
      <MeetingFooter
        props={props}
        now={clock.now}
        dateDraft={clock.dateDraft}
        setDateDraft={clock.setDateDraft}
        visibleRange={clock.visibleRange}
        setCalendarDate={clock.setCalendarDate}
        selectedClass={selection.selectedClass}
      />
      {(selection.manualError || props.error) && (
        <p role="alert" className={styles.error}>
          {selection.manualError ?? props.error}
        </p>
      )}
    </div>
  );
}

export function ClassMeetingStep(props: Props): ReactElement {
  const clock = useMeetingClock(props);
  const query = useMeetingAvailability(props, clock);
  const context = {
    data: query.data,
    teacher: props.teacher,
    visibleRange: clock.visibleRange,
    now: clock.now,
    blocked: meetingBlocked(query.data),
  };
  const events = meetingEvents(query.data, { context, kind: props.kind });
  const selection = useMeetingSelection({ props, clock, query, context });
  return (
    <MeetingContent
      props={props}
      clock={clock}
      query={query}
      context={context}
      events={events}
      selection={selection}
    />
  );
}
