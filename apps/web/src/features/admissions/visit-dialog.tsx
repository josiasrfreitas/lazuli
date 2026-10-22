"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type JSX,
  type SetStateAction,
} from "react";
import {
  getScheduleCalendarRange,
  type CalendarBlockedInterval,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
  type SearchSelectOption,
} from "@lazuli/ui";
import { entryVisitScheduleSchema } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { useLeadErrors } from "./lead-form";
import { dateOnly, formatLabel, type Candidate } from "./labels";
import { trialVisitInput } from "./trial-visit-input";
import { TrialVisitDialogView } from "./trial-visit-dialog-view";

const CLOCK_REFRESH_INTERVAL_MS = 30_000;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
type VisitInput = { candidate: Candidate; previousVisitId?: string; onClose: () => void };
type VisitKind = "TRIAL" | "INTRODUCTION";
type VisitFormat = "IN_PERSON" | "ONLINE";
type Setter<T> = Dispatch<SetStateAction<T>>;
type PreviousVisit = Candidate["visits"][number] | undefined;

function initialVisitDate(previous: PreviousVisit, today: string): string {
  return previous && dateOnly(previous.date) > today ? dateOnly(previous.date) : today;
}

function initialVisitKind(previous: PreviousVisit, candidate: Candidate): VisitKind {
  return previous?.kind === "INTRODUCTION" || candidate.scheduleType === "PERSONALIZED"
    ? "INTRODUCTION"
    : "TRIAL";
}

function initialVisitTeacher(previous: PreviousVisit): SearchSelectOption | null {
  return previous?.teacherId
    ? { id: previous.teacherId, label: previous.teacherName ?? "Professor" }
    : null;
}

function schoolClock(): { date: string; time: string } {
  const now = new Date();
  return {
    date: toDateOnlySaoPaulo(now),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now),
  };
}

function useSchoolClock(): ReturnType<typeof schoolClock> {
  const [now, setNow] = useState(schoolClock);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(schoolClock()), CLOCK_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}

export type VisitState = {
  dirty: boolean;
  setDirty: Setter<boolean>;
  discarding: boolean;
  setDiscarding: Setter<boolean>;
  id: string;
  now: ReturnType<typeof schoolClock>;
  date: string;
  setDate: Setter<string>;
  view: CalendarView;
  setView: Setter<CalendarView>;
  kind: VisitKind;
  setKind: Setter<VisitKind>;
  teacher: SearchSelectOption | null;
  setTeacher: Setter<SearchSelectOption | null>;
  classFilter: string;
  setClassFilter: Setter<string>;
  format: VisitFormat;
  setFormat: Setter<VisitFormat>;
  meetingId: string | null;
  setMeetingId: Setter<string | null>;
  draftDate: string;
  setDraftDate: Setter<string>;
  start: string;
  setStart: Setter<string>;
  end: string;
  setEnd: Setter<string>;
  notes: string;
  setNotes: Setter<string>;
};

function useVisitState({ candidate, previousVisitId }: VisitInput): VisitState {
  const previous = candidate.visits.find((row) => row.id === previousVisitId);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState(() => initialVisitDate(previous, candidate.today));
  const initialKind = initialVisitKind(previous, candidate);
  const [view, setView] = useState<CalendarView>(initialKind === "INTRODUCTION" ? "week" : "day");
  const [kind, setKind] = useState<VisitKind>(initialKind);
  const [teacher, setTeacher] = useState<SearchSelectOption | null>(initialVisitTeacher(previous));
  const [classFilter, setClassFilter] = useState("ALL");
  const [format, setFormat] = useState<VisitFormat>(
    previous?.format ?? candidate.format ?? "IN_PERSON",
  );
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(formatDateOnlyBR(date));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState(previous?.notes ?? "");
  return {
    dirty,
    setDirty,
    discarding,
    setDiscarding,
    id,
    now: useSchoolClock(),
    date,
    setDate,
    view,
    setView,
    kind,
    setKind,
    teacher,
    setTeacher,
    classFilter,
    setClassFilter,
    format,
    setFormat,
    meetingId,
    setMeetingId,
    draftDate,
    setDraftDate,
    start,
    setStart,
    end,
    setEnd,
    notes,
    setNotes,
  };
}

type VisitQuery = QueryResult<RouterOutputs["admissions"]["visitCalendar"]>;
type VisitMeeting = NonNullable<VisitQuery["data"]>["meetings"][number];
export type VisitCalendarData = {
  window: { date: string; view: CalendarView; dayCount: number; minDate: string };
  period: ReturnType<typeof getScheduleCalendarRange>;
  query: VisitQuery;
  meetings: VisitMeeting[];
  chosen: VisitMeeting | undefined;
  blocked: CalendarBlockedInterval[];
  classOptions: Array<{ value: string; label: string }>;
};

function visitBlocked(query: VisitQuery, kind: VisitKind): CalendarBlockedInterval[] {
  return [
    ...(query.data?.leadBusy ?? []),
    ...(query.data?.closedDays ?? []).map((day) => ({
      id: `closed-${day.date}`,
      date: day.date,
      startTime: "00:00",
      endTime: "24:00",
      label: `Escola fechada: ${day.reason}`,
    })),
    ...(kind === "INTRODUCTION"
      ? [
          ...(query.data?.teacherBusy ?? []),
          ...(query.data?.meetings ?? []).map((row) => ({
            ...row,
            label: `Aula do professor · ${row.className}`,
          })),
        ]
      : []),
  ];
}

function useVisitCalendar(input: VisitInput, state: VisitState): VisitCalendarData {
  const window = { date: state.date, view: state.view, dayCount: 7, minDate: state.now.date };
  const period = getScheduleCalendarRange(window);
  const query = trpc.admissions.visitCalendar.useQuery(
    {
      candidateId: input.candidate.id,
      ...period,
      ...(state.kind === "INTRODUCTION" && state.teacher ? { teacherId: state.teacher.id } : {}),
      ...(input.previousVisitId ? { previousVisitId: input.previousVisitId } : {}),
    },
    { retry: false },
  );
  const meetings = (query.data?.meetings ?? []).filter(
    (row) => `${row.date} ${row.startTime}` > `${state.now.date} ${state.now.time}`,
  );
  const classOptions = [
    ...new Map(
      meetings.map((row) => [row.classId, { value: row.classId, label: row.className }]),
    ).values(),
  ];
  return {
    window,
    period,
    query,
    meetings,
    chosen: meetings.find((row) => row.id === state.meetingId),
    blocked: visitBlocked(query, state.kind),
    classOptions,
  };
}

function calendarCoversRange(range: CalendarInterval, calendar: VisitCalendarData): boolean {
  return Boolean(
    calendar.query.data &&
    !calendar.query.isFetching &&
    range.date >= calendar.period.from &&
    range.date <= calendar.period.through,
  );
}

function intervalError(
  range: CalendarInterval,
  { state, calendar }: { state: VisitState; calendar: VisitCalendarData },
): string | undefined {
  if (
    !timePattern.test(range.startTime) ||
    !timePattern.test(range.endTime) ||
    range.endTime <= range.startTime
  )
    return "Informe início e término válidos.";
  if (`${range.date} ${range.startTime}` <= `${state.now.date} ${state.now.time}`)
    return "Escolha uma aula que ainda não começou.";
  if (!calendarCoversRange(range, calendar))
    return "Consulte o período na agenda antes de confirmar.";
  return calendar.blocked.find(
    (item) =>
      item.date === range.date && item.startTime < range.endTime && range.startTime < item.endTime,
  )?.label;
}

function trialEvents(
  calendar: VisitCalendarData,
  {
    state,
    checkInterval,
  }: {
    state: VisitState;
    checkInterval: (range: CalendarInterval) => string | undefined;
  },
): CalendarEvent[] {
  return calendar.meetings
    .filter((row) => state.classFilter === "ALL" || row.classId === state.classFilter)
    .map((row) => {
      const reason = checkInterval(row);
      return {
        ...row,
        title: row.className,
        subtitle: `${row.teacherName} · ${formatLabel(row.format)}`,
        description: row.stageName ?? "PPT",
        disabled: Boolean(reason),
        ...(reason ? { disabledReason: reason } : {}),
      };
    });
}

function introductionEvents(calendar: VisitCalendarData): CalendarEvent[] {
  if (!calendar.query.data) return [];
  return [
    ...calendar.meetings.map((row) => ({
      ...row,
      title: row.className,
      subtitle: "Aula do professor",
      disabled: true,
    })),
    ...(calendar.query.data.teacherBusy ?? []).map((row) => ({
      ...row,
      title: row.label,
      disabled: true,
    })),
    ...(calendar.query.data.leadBusy ?? []).map((row) => ({
      ...row,
      id: `lead-${row.id}`,
      title: row.label,
      disabled: true,
    })),
  ];
}

export type VisitValidation = {
  individual: CalendarInterval | null;
  selected: CalendarInterval | VisitMeeting | null;
  selectionError: string | undefined;
  ready: boolean;
  events: CalendarEvent[];
  times: string[];
  checkInterval: (range: CalendarInterval) => string | undefined;
};

function visitValidation(state: VisitState, calendar: VisitCalendarData): VisitValidation {
  const individual = individualSelection(state);
  const selected = state.kind === "TRIAL" ? (calendar.chosen ?? null) : individual;
  const checkInterval = (range: CalendarInterval): string | undefined =>
    intervalError(range, { state, calendar });
  const selectionError = selected ? checkInterval(selected) : undefined;
  const ready = visitReady({ state, calendar }, { selected, selectionError });
  const events = visitEvents({ state, calendar }, checkInterval);
  const times = visitTimes(state, { events, ready, selected });
  return { individual, selected, selectionError, ready, events, times, checkInterval };
}

function individualSelection(state: VisitState): CalendarInterval | null {
  const date = parseDateBR(state.draftDate);
  return date && state.start && state.end
    ? { date, startTime: state.start, endTime: state.end }
    : null;
}

function visitReady(
  { state, calendar }: { state: VisitState; calendar: VisitCalendarData },
  { selected, selectionError }: Pick<VisitValidation, "selected" | "selectionError">,
): boolean {
  return Boolean(
    selected &&
    !selectionError &&
    calendar.query.isSuccess &&
    !calendar.query.isFetching &&
    (state.kind === "TRIAL" || state.teacher),
  );
}

function visitEvents(
  { state, calendar }: { state: VisitState; calendar: VisitCalendarData },
  checkInterval: (range: CalendarInterval) => string | undefined,
): CalendarEvent[] {
  if (state.kind === "TRIAL") return trialEvents(calendar, { state, checkInterval });
  return state.teacher ? introductionEvents(calendar) : [];
}

function visitTimes(
  state: VisitState,
  { events, ready, selected }: Pick<VisitValidation, "events" | "ready" | "selected">,
): string[] {
  return [
    ...(state.kind === "TRIAL" && events.length > 0 ? [] : ["08:00", "22:00"]),
    ...events.flatMap((row) => [row.startTime, row.endTime]),
    ...(ready && selected ? [selected.startTime, selected.endTime] : []),
  ].toSorted();
}

type VisitSave = ReturnType<typeof trpc.admissions.schedule.useMutation>;
type VisitErrors = ReturnType<typeof useLeadErrors>;
export type VisitActions = {
  errors: VisitErrors;
  save: VisitSave;
  requestClose: () => void;
  resetSelection: () => void;
  navigate: (next: string) => void;
  selectRange: (range: CalendarInterval) => void;
  submit: (event: FormEvent) => void;
};

function useVisitSave(onClose: () => void): VisitSave {
  const utils = trpc.useUtils();
  return trpc.admissions.schedule.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classRecords.invalidate(),
        utils.teachers.invalidate(),
      ]);
      onClose();
    },
  });
}

function useVisitEdits({
  state,
  errors,
  save,
}: {
  state: VisitState;
  errors: VisitErrors;
  save: VisitSave;
}): Pick<VisitActions, "resetSelection" | "navigate" | "selectRange"> {
  function resetSelection(): void {
    state.setMeetingId(null);
    state.setStart("");
    state.setEnd("");
    errors.clear("schedule");
    save.reset();
  }
  function navigate(next: string): void {
    state.setDate(next);
    state.setDraftDate(formatDateOnlyBR(next));
    resetSelection();
  }
  function selectRange(range: CalendarInterval): void {
    state.setDirty(true);
    state.setDraftDate(formatDateOnlyBR(range.date));
    state.setStart(range.startTime);
    state.setEnd(range.endTime);
    errors.clear("schedule");
    save.reset();
  }
  return { resetSelection, navigate, selectRange };
}

function submitVisit(
  event: FormEvent,
  {
    input,
    state,
    calendar,
    validation,
    errors,
    save,
  }: {
    input: VisitInput;
    state: VisitState;
    calendar: VisitCalendarData;
    validation: VisitValidation;
    errors: VisitErrors;
    save: VisitSave;
  },
): void {
  event.preventDefault();
  if (save.isPending) return;
  if (!validation.ready || !validation.selected)
    return errors.report([
      { path: ["schedule"], message: validation.selectionError ?? "Escolha o horário na agenda." },
    ]);
  const parsed = entryVisitScheduleSchema.safeParse({
    id: state.id,
    candidateId: input.candidate.id,
    notes: state.notes,
    ...(input.previousVisitId ? { previousVisitId: input.previousVisitId } : {}),
    ...(state.kind === "TRIAL"
      ? trialVisitInput(calendar.meetings, state.meetingId)
      : {
          date: validation.selected.date,
          meeting: {
            kind: "INTRODUCTION",
            teacherId: state.teacher?.id,
            startTime: validation.selected.startTime,
            endTime: validation.selected.endTime,
            format: state.format,
          },
        }),
  });
  if (!parsed.success) return errors.report(parsed.error.issues);
  save.mutate(parsed.data);
}

function useVisitActions({
  input,
  state,
  calendar,
  validation,
}: Omit<VisitViewProps, "actions">): VisitActions {
  const errors = useLeadErrors();
  const save = useVisitSave(input.onClose);
  const edits = useVisitEdits({ state, errors, save });
  function requestClose(): void {
    if (save.isPending || state.discarding) return;
    if (state.dirty) state.setDiscarding(true);
    else input.onClose();
  }
  const submit = (event: FormEvent): void =>
    submitVisit(event, { input, state, calendar, validation, errors, save });
  return { errors, save, requestClose, ...edits, submit };
}

export type VisitViewProps = {
  input: VisitInput;
  state: VisitState;
  calendar: VisitCalendarData;
  validation: VisitValidation;
  actions: VisitActions;
};

export function VisitDialog(input: VisitInput): JSX.Element {
  const state = useVisitState(input);
  const calendar = useVisitCalendar(input, state);
  const validation = visitValidation(state, calendar);
  const actions = useVisitActions({ input, state, calendar, validation });
  return <TrialVisitDialogView {...{ input, state, calendar, validation, actions }} />;
}
