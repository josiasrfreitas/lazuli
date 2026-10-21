"use client";

import { useEffect, useRef, useState, type ReactNode, type ReactElement } from "react";
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
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

export function ClassMeetingStep(props: Props): ReactElement {
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
  const dateWindow = { date: calendarDate, view, dayCount: 7, minDate: now.date };
  const visibleRange = getScheduleCalendarRange(dateWindow);
  const visibleDate = calendarDate < now.date ? now.date : calendarDate;
  function navigate(date: string): void {
    const next = date < now.date ? now.date : date;
    setCalendarDate(next);
    props.onDateChange(next);
  }
  const query = trpc.appointments.availability.useQuery(
    {
      teacherId: props.teacher?.id ?? "00000000-0000-0000-0000-000000000000",
      studentId: props.studentId,
      week: visibleRange.from,
      through: visibleRange.through,
      ...(props.previousId ? { excludeAppointmentId: props.previousId } : {}),
    },
    {
      enabled: Boolean(props.teacher && props.studentId),
      retry: false,
      refetchOnWindowFocus: true,
    },
  );
  const data = query.data;
  const teacherBlocked: CalendarBlockedInterval[] = [
    ...(data?.classes ?? []).map((row) => ({
      id: `class-${row.id}`,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      label: `Aula · ${row.className}`,
    })),
    ...(data?.teacherBusy ?? []).map((row) => ({ ...row, id: `teacher-${row.id}` })),
  ];
  const blocked: CalendarBlockedInterval[] = [
    ...teacherBlocked,
    ...(data?.studentBusy ?? []).map((row) => ({ ...row, id: `student-${row.id}` })),
  ];
  function intervalError(range: CalendarInterval, forClass = false): string | undefined {
    if (!clock.test(range.startTime) || !clock.test(range.endTime))
      return "Informe início e fim em hh:mm.";
    if (range.endTime <= range.startTime) return "O fim deve ser depois do início.";
    if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
      return "Escolha um horário que ainda não começou.";
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
    const conflict = conflicts.find((item) => overlaps(range, item));
    if (conflict) return `${conflict.label} · ${conflict.startTime}–${conflict.endTime}.`;
    return undefined;
  }
  const events: MeetingEvent[] = [
    ...(data?.classes ?? []).map((row): MeetingEvent => {
      const range = { date: row.date, startTime: row.startTime, endTime: row.endTime };
      const invalid = intervalError(range, true);
      const reason = row.selectable ? invalid : "Aula ainda não preparada para agendamento.";
      return {
        ...range,
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
        disabled: props.kind !== "CLASS" || Boolean(reason),
        ...(reason ? { disabledReason: reason } : {}),
      };
    }),
    ...(data?.teacherBusy ?? []).map(
      (row): MeetingEvent => ({
        ...row,
        id: `busy-${row.id}`,
        title: row.label,
        disabled: true,
      }),
    ),
  ];
  const selectedClass = data?.classes.find((row) => row.sessionId === props.sessionId);
  const selectedRange: CalendarInterval = {
    date: props.date,
    startTime: props.startTime,
    endTime: props.endTime,
  };
  const currentClass = Boolean(
    selectedClass && selectedClass.selectable && !intervalError(selectedClass, true),
  );
  const manualError =
    props.kind === "INDEPENDENT"
      ? dateDraft === formatDateOnlyBR(props.date)
        ? props.startTime && props.endTime
          ? intervalError(selectedRange)
          : undefined
        : "Informe uma data válida."
      : undefined;
  const ready = Boolean(
    query.isSuccess &&
    !query.isFetching &&
    (props.kind === "CLASS"
      ? currentClass
      : props.teacher && props.startTime && props.endTime && !manualError),
  );
  useEffect(() => props.onReadyChange(ready), [ready, props.onReadyChange]);
  const status =
    !props.teacher || query.isFetching || query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : "ready";
  return (
    <div
      ref={step}
      tabIndex={-1}
      role="group"
      aria-label={props.kind === "CLASS" ? "Selecione uma aula" : "Selecione um horário livre"}
      className={styles.layout}
    >
      <ScheduleCalendarToolbar
        date={visibleDate}
        today={now.date}
        view={view}
        teacher={props.teacher}
        onTeacherChange={props.onTeacherChange}
        onDateChange={navigate}
        onViewChange={setView}
      />
      {!props.teacher && (
        <p role="status" className="text-caption text-muted-foreground">
          Selecione um professor para consultar a agenda.
        </p>
      )}
      <div className={styles.calendar}>
        <AppointmentCalendar<MeetingEvent>
          collapseEmptyShifts={props.kind === "CLASS"}
          toolbar={false}
          date={visibleDate}
          view={view}
          dayCount={7}
          minDate={now.date}
          density="compact"
          expandEvents={false}
          label="Disponibilidade para atendimento"
          events={events}
          status={status}
          errorMessage="Não foi possível consultar a disponibilidade. Tente novamente."
          onRetry={() => void query.refetch()}
          onDateChange={navigate}
          onViewChange={setView}
          selectedEventId={
            props.kind === "CLASS" && props.sessionId ? `class-${selectedClass?.id}` : undefined
          }
          onEventActivate={(event) => {
            if (props.kind === "CLASS" && event.sessionId)
              props.onSelect({
                date: event.date,
                startTime: event.startTime,
                endTime: event.endTime,
                sessionId: event.sessionId,
                format: event.format,
              });
          }}
          emptyMessage={
            props.kind === "CLASS"
              ? "Nenhuma aula deste professor neste período."
              : "Período livre. Escolha um horário na agenda."
          }
          rangeSelection={
            props.kind === "INDEPENDENT"
              ? {
                  clickDurationMinutes: props.durationMinutes || DEFAULT_APPOINTMENT_MINUTES,
                  value: props.startTime && props.endTime && !manualError ? selectedRange : null,
                  minimum: now,
                  blocked,
                  getError: (range) => intervalError(range),
                  onSelect: (range) => props.onSelect(range),
                  controls: <></>,
                }
              : undefined
          }
        />
      </div>
      <div className={styles.footer}>
        {props.kind === "INDEPENDENT" ? (
          <div className={styles.selection} aria-label="Horário do atendimento">
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
                  if (parsed < visibleRange.from || parsed > visibleRange.through)
                    setCalendarDate(parsed);
                }
              }}
            />
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
          </div>
        ) : (
          <div className={styles.summary} aria-live="polite">
            {selectedClass ? (
              <>
                <strong>{selectedClass.className}</strong>
                <span>
                  {formatDateOnlyBR(selectedClass.date)} · {selectedClass.startTime}–
                  {selectedClass.endTime} ·{" "}
                  {selectedClass.format === "ONLINE" ? "Online" : "Presencial"}
                </span>
              </>
            ) : (
              <p className="text-muted-foreground">Selecione uma aula na agenda.</p>
            )}
          </div>
        )}
        <div className={styles.actions}>{props.actions}</div>
      </div>
      {(manualError || props.error) && (
        <p role="alert" className={styles.error}>
          {manualError ?? props.error}
        </p>
      )}
    </div>
  );
}
