"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  getScheduleCalendarRange,
  type CalendarBlockedInterval,
  type CalendarDateRange,
  type CalendarInterval,
  type CalendarView,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import type { MeetingProps, MeetingEvent } from "./meeting-types";
const CLOCK_REFRESH_MS = 30_000;
export const BATCH_DAYS = 7;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
type SchoolClock = { date: string; time: string };
type Availability = RouterOutputs["appointments"]["availability"];
type AvailabilityQuery = ReturnType<typeof trpc.appointments.availability.useQuery<Availability>>;
type CalendarDraft = {
  step: RefObject<HTMLDivElement | null>;
  dateDraft: string;
  view: CalendarView;
  setView: (view: CalendarView) => void;
  visibleDate: string;
  visibleRange: CalendarDateRange;
  navigate: (date: string) => void;
  editDate: (value: string) => void;
};
type IntervalContext = {
  props: MeetingProps;
  now: SchoolClock;
  data: Availability | undefined;
  visibleRange: CalendarDateRange;
  blocked: CalendarBlockedInterval[];
  forClass: boolean;
};
export type MeetingModel = {
  calendar: CalendarDraft;
  now: SchoolClock;
  query: AvailabilityQuery;
  blocked: CalendarBlockedInterval[];
  events: MeetingEvent[];
  selectedClass: Availability["classes"][number] | undefined;
  selectedRange: CalendarInterval;
  manualError: string | undefined;
  status: "loading" | "error" | "ready";
  getError: (range: CalendarInterval, forClass?: boolean) => string | undefined;
};
function schoolClock(): SchoolClock {
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
function useSchoolClock(): SchoolClock {
  const [now, setNow] = useState(schoolClock);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(schoolClock()), CLOCK_REFRESH_MS);
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}
function useCalendarDraft(props: MeetingProps, now: SchoolClock): CalendarDraft {
  const step = useRef<HTMLDivElement>(null);
  const [calendarDate, setCalendarDate] = useState(props.date);
  const [view, setView] = useState<CalendarView>("week");
  const [dateDraft, setDateDraft] = useState(formatDateOnlyBR(props.date));
  useEffect(() => setDateDraft(formatDateOnlyBR(props.date)), [props.date]);
  useEffect(() => step.current?.focus(), []);
  const visibleRange = getScheduleCalendarRange({
    date: calendarDate,
    view,
    dayCount: BATCH_DAYS,
    minDate: now.date,
  });
  const visibleDate = futureDate(calendarDate, now.date);
  function navigate(date: string): void {
    const next = futureDate(date, now.date);
    setCalendarDate(next);
    props.onDateChange(next);
  }
  function editDate(value: string): void {
    setDateDraft(value);
    const parsed = parseDateBR(value);
    if (!parsed) return;
    props.onDateChange(parsed);
    if (parsed < visibleRange.from || parsed > visibleRange.through) setCalendarDate(parsed);
  }
  return { step, dateDraft, view, setView, visibleDate, visibleRange, navigate, editDate };
}
function useAvailability(props: MeetingProps, calendar: CalendarDraft): AvailabilityQuery {
  return trpc.appointments.availability.useQuery(
    {
      teacherId: props.teacher?.id ?? "00000000-0000-0000-0000-000000000000",
      studentId: props.studentId,
      week: calendar.visibleRange.from,
      through: calendar.visibleRange.through,
      ...(props.previousId ? { excludeAppointmentId: props.previousId } : {}),
    },
    {
      enabled: Boolean(props.teacher && props.studentId),
      retry: false,
      refetchOnWindowFocus: true,
    },
  );
}
export function useMeetingModel(props: MeetingProps): MeetingModel {
  const now = useSchoolClock();
  const calendar = useCalendarDraft(props, now);
  const query = useAvailability(props, calendar);
  const data = query.data;
  const blocked = blockedIntervals(data);
  const getError = (range: CalendarInterval, forClass = false): string | undefined =>
    validateInterval(range, {
      props,
      now,
      data,
      visibleRange: calendar.visibleRange,
      blocked,
      forClass,
    });
  const selectedClass = data?.classes.find((row) => row.sessionId === props.sessionId);
  const selectedRange = { date: props.date, startTime: props.startTime, endTime: props.endTime };
  const manualError = manualRangeError(props, {
    dateDraft: calendar.dateDraft,
    getError,
    selectedRange,
  });
  const ready =
    query.isSuccess &&
    !query.isFetching &&
    selectionReady(props, { selectedClass, getError, manualError });
  useEffect(() => props.onReadyChange(ready), [ready, props.onReadyChange]);
  return {
    calendar,
    now,
    query,
    blocked,
    getError,
    selectedClass,
    selectedRange,
    manualError,
    events: meetingEvents(data, { props, getError }),
    status: calendarStatus(props, query),
  };
}
function blockedIntervals(data: Availability | undefined): CalendarBlockedInterval[] {
  return [
    ...(data?.classes ?? []).map((row) => ({
      id: `class-${row.id}`,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      label: `Aula · ${row.className}`,
    })),
    ...(data?.teacherBusy ?? []).map((row) => ({ ...row, id: `teacher-${row.id}` })),
    ...(data?.studentBusy ?? []).map((row) => ({ ...row, id: `student-${row.id}` })),
  ];
}
function rangeError(range: CalendarInterval, now: SchoolClock): string | undefined {
  if (!clock.test(range.startTime) || !clock.test(range.endTime))
    return "Informe início e fim em hh:mm.";
  if (range.endTime <= range.startTime) return "O fim deve ser depois do início.";
  if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
    return "Escolha um horário que ainda não começou.";
  return undefined;
}
function validateInterval(range: CalendarInterval, context: IntervalContext): string | undefined {
  const invalid = rangeError(range, context.now);
  if (invalid) return invalid;
  const { props, data, visibleRange, forClass, blocked } = context;
  if (
    !data ||
    !props.teacher ||
    range.date < visibleRange.from ||
    range.date > visibleRange.through
  )
    return "Consulte a disponibilidade do período selecionado.";
  const closed = data.closedDays.find((row) => row.date === range.date);
  if (closed) return `Escola fechada: ${closed.reason}.`;
  const conflicts = forClass ? [...data.teacherBusy, ...data.studentBusy] : blocked;
  const conflict = conflicts.find(
    (item) =>
      range.date === item.date && range.startTime < item.endTime && item.startTime < range.endTime,
  );
  return conflict ? `${conflict.label} · ${conflict.startTime}–${conflict.endTime}.` : undefined;
}
type SelectionCheck = {
  getError: MeetingModel["getError"];
  selectedClass: MeetingModel["selectedClass"];
  manualError: string | undefined;
};
function selectionReady(props: MeetingProps, state: SelectionCheck): boolean {
  if (props.kind === "CLASS")
    return Boolean(state.selectedClass?.selectable && !state.getError(state.selectedClass, true));
  return Boolean(props.teacher && props.startTime && props.endTime && !state.manualError);
}
function manualRangeError(
  props: MeetingProps,
  state: { dateDraft: string; getError: MeetingModel["getError"]; selectedRange: CalendarInterval },
): string | undefined {
  if (props.kind !== "INDEPENDENT") return undefined;
  if (state.dateDraft !== formatDateOnlyBR(props.date)) return "Informe uma data válida.";
  return props.startTime && props.endTime ? state.getError(state.selectedRange) : undefined;
}
function calendarStatus(props: MeetingProps, query: AvailabilityQuery): MeetingModel["status"] {
  if (!props.teacher || query.isFetching || query.isPending) return "loading";
  return query.isError ? "error" : "ready";
}
function meetingEvents(
  data: Availability | undefined,
  state: { props: MeetingProps; getError: MeetingModel["getError"] },
): MeetingEvent[] {
  return [
    ...(data?.classes ?? []).map((row) => classEvent(row, state)),
    ...(data?.teacherBusy ?? []).map(
      (row): MeetingEvent => ({ ...row, id: `busy-${row.id}`, title: row.label, disabled: true }),
    ),
  ];
}
function classEvent(
  row: Availability["classes"][number],
  state: { props: MeetingProps; getError: MeetingModel["getError"] },
): MeetingEvent {
  const invalid = state.getError(row, true);
  const reason = row.selectable ? invalid : "Aula ainda não preparada para agendamento.";
  return {
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    id: `class-${row.id}`,
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
    disabled: state.props.kind !== "CLASS" || Boolean(reason),
    disabledReason: reason,
  };
}

function futureDate(date: string, minimum: string): string {
  if (date < minimum) return minimum;
  return date;
}
