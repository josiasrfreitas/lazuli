"use client";

import type { Dispatch, JSX as ReactJSX, SetStateAction } from "react";
import { useEffect, useState, type FormEvent } from "react";
import {
  getScheduleCalendarRange,
  type CalendarBlockedInterval,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
} from "@lazuli/ui";
import { placementScheduleSchema, type z } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { useLeadErrors } from "./lead-form";
import type { Candidate } from "./labels";
import { PlacementScheduleView } from "./placement-schedule-view";

const CLOCK_REFRESH_INTERVAL_MS = 30_000;

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type PlacementScheduleDraft = {
  teacherId: string;
  date: string;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
};

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

type ScheduleProps = {
  candidate: Pick<Candidate, "id" | "fullName" | "today" | "format">;
  onClose: () => void;
  registration?: {
    id?: string;
    onConfirm: (values: z.infer<typeof placementScheduleSchema>) => void;
    onBack: () => void;
    onDefer: () => void;
    onDirty: () => void;
    draft: PlacementScheduleDraft | null;
    onDraftChange: (draft: PlacementScheduleDraft) => void;
    pending: boolean;
    error?: string | undefined;
  };
};

type ScheduleState = {
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  discarding: boolean;
  setDiscarding: Dispatch<SetStateAction<boolean>>;
  id: string;
  now: ReturnType<typeof schoolClock>;
  calendarDate: string;
  setCalendarDate: Dispatch<SetStateAction<string>>;
  view: CalendarView;
  setView: Dispatch<SetStateAction<CalendarView>>;
  draft: PlacementScheduleDraft;
  setDraft: Dispatch<SetStateAction<PlacementScheduleDraft>>;
};

function useSchoolClock(): ReturnType<typeof schoolClock> {
  const [now, setNow] = useState(schoolClock);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(schoolClock()), CLOCK_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}

function useScheduleState({ candidate, registration }: ScheduleProps): ScheduleState {
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [id] = useState(() => registration?.id ?? crypto.randomUUID());
  const now = useSchoolClock();
  const [calendarDate, setCalendarDate] = useState(
    () => parseDateBR(registration?.draft?.date ?? "") ?? candidate.today,
  );
  const [view, setView] = useState<CalendarView>("week");
  const [draft, setDraft] = useState<PlacementScheduleDraft>(
    () =>
      registration?.draft ?? {
        date: formatDateOnlyBR(candidate.today),
        teacherId: "",
        startTime: "",
        endTime: "",
        format: candidate.format ?? "IN_PERSON",
      },
  );
  const onDraftChange = registration?.onDraftChange;
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  return {
    dirty,
    setDirty,
    discarding,
    setDiscarding,
    id,
    now,
    calendarDate,
    setCalendarDate,
    view,
    setView,
    draft,
    setDraft,
  };
}

type ScheduleCalendarData = {
  calendarWindow: { date: string; view: CalendarView; dayCount: number; minDate: string };
  period: ReturnType<typeof getScheduleCalendarRange>;
  blocked: CalendarBlockedInterval[];
  events: CalendarEvent[];
  isFetching: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  hasData: boolean;
  pendingPlacement: boolean;
  retry: () => void;
};

function useScheduleCalendar(props: ScheduleProps, state: ScheduleState): ScheduleCalendarData {
  const calendarWindow = {
    date: state.calendarDate,
    view: state.view,
    dayCount: 7,
    minDate: state.now.date,
  };
  const period = getScheduleCalendarRange(calendarWindow);
  const calendar = trpc.admissions.placementCalendar.useQuery(
    { ...(props.registration ? {} : { candidateId: props.candidate.id }), ...period },
    { retry: false, refetchOnWindowFocus: true },
  );
  const blocked: CalendarBlockedInterval[] = [
    ...(calendar.data?.visits ?? []),
    ...(calendar.data?.closedDays ?? []).map((day) => ({
      id: `closed-${day.date}`,
      date: day.date,
      startTime: "00:00",
      endTime: "24:00",
      label: `Escola fechada: ${day.reason}`,
    })),
  ];
  const events: CalendarEvent[] = (calendar.data?.visits ?? []).map((visit) => ({
    ...visit,
    title: visit.label,
    disabled: true,
    disabledReason: "Este lead já tem um atendimento neste horário.",
  }));
  return {
    calendarWindow,
    period,
    blocked,
    events,
    isFetching: calendar.isFetching,
    isPending: calendar.isPending,
    isError: calendar.isError,
    isSuccess: calendar.isSuccess,
    hasData: Boolean(calendar.data),
    pendingPlacement: Boolean(calendar.data?.pendingPlacement),
    retry: () => void calendar.refetch(),
  };
}

function calendarCoversRange(range: CalendarInterval, calendar: ScheduleCalendarData): boolean {
  if (!calendar.hasData || calendar.isFetching) return false;
  return range.date >= calendar.period.from && range.date <= calendar.period.through;
}

function intervalError(
  range: CalendarInterval,
  context: { now: ScheduleState["now"]; calendar: ScheduleCalendarData },
): string | undefined {
  const { now, calendar } = context;
  if (!timePattern.test(range.startTime) || !timePattern.test(range.endTime))
    return "Informe início e término em hh:mm.";
  if (range.endTime <= range.startTime) return "O término deve ser posterior ao início.";
  if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
    return "Escolha um horário que ainda não começou.";
  if (!calendarCoversRange(range, calendar))
    return "Consulte o período na agenda antes de confirmar.";
  if (calendar.pendingPlacement)
    return "Este lead já tem um nivelamento agendado. Conclua ou cancele o atendimento anterior.";
  const conflict = calendar.blocked.find(
    (item) =>
      item.date === range.date && item.startTime < range.endTime && range.startTime < item.endTime,
  );
  return conflict?.label;
}

type ScheduleValidation = {
  parsedDate: string | null;
  selection: CalendarInterval | null;
  selectionError: string | undefined;
  ready: boolean;
  times: string[];
  intervalError: (range: CalendarInterval) => string | undefined;
};

function scheduleValidation(
  state: ScheduleState,
  calendar: ScheduleCalendarData,
): ScheduleValidation {
  const parsedDate = parseDateBR(state.draft.date);
  const selection =
    parsedDate && state.draft.startTime && state.draft.endTime
      ? { date: parsedDate, startTime: state.draft.startTime, endTime: state.draft.endTime }
      : null;
  const checkInterval = (range: CalendarInterval): string | undefined =>
    intervalError(range, { now: state.now, calendar });
  const selectionError = selection ? checkInterval(selection) : undefined;
  const ready = [
    calendar.isSuccess,
    !calendar.isFetching,
    selection,
    !selectionError,
    state.draft.teacherId,
  ].every(Boolean);
  const times = [
    "08:00",
    "22:00",
    ...calendar.events.flatMap((event) => [event.startTime, event.endTime]),
    ...(selection && !selectionError ? [selection.startTime, selection.endTime] : []),
  ].toSorted();
  return { parsedDate, selection, selectionError, ready, times, intervalError: checkInterval };
}

type ScheduleSave = ReturnType<typeof trpc.admissions.placementSchedule.useMutation>;
type ScheduleErrors = ReturnType<typeof useLeadErrors>;
type ScheduleActions = {
  errors: ScheduleErrors;
  save: ScheduleSave;
  pending: boolean;
  requestClose: () => void;
  markDirty: () => void;
  change: <K extends keyof PlacementScheduleDraft>(
    key: K,
    value: PlacementScheduleDraft[K],
  ) => void;
  navigate: (date: string) => void;
  selectRange: (range: CalendarInterval) => void;
  submit: (event: FormEvent) => void;
  message: string | undefined;
};

type ScheduleEdits = Pick<ScheduleActions, "markDirty" | "change" | "navigate" | "selectRange">;

function useScheduleEdits(input: {
  props: ScheduleProps;
  state: ScheduleState;
  errors: ScheduleErrors;
  save: ScheduleSave;
  pending: boolean;
}): ScheduleEdits {
  const { props, state, errors, save, pending } = input;
  function markDirty(): void {
    state.setDirty(true);
    props.registration?.onDirty();
  }
  function change<K extends keyof PlacementScheduleDraft>(
    key: K,
    value: PlacementScheduleDraft[K],
  ): void {
    markDirty();
    state.setDraft((current) => ({ ...current, [key]: value }));
    errors.clear(key);
    errors.clear("schedule");
    save.reset();
  }
  function navigate(date: string): void {
    state.setCalendarDate(date);
    state.setDraft((current) => ({
      ...current,
      date: formatDateOnlyBR(date),
      startTime: "",
      endTime: "",
    }));
    errors.clear("date");
    errors.clear("schedule");
    save.reset();
  }
  function selectRange(range: CalendarInterval): void {
    if (pending) return;
    markDirty();
    state.setDraft((current) => ({ ...current, ...range, date: formatDateOnlyBR(range.date) }));
    for (const key of ["date", "startTime", "endTime", "schedule"]) errors.clear(key);
    save.reset();
  }
  return { markDirty, change, navigate, selectRange };
}

function useScheduleSave(onClose: () => void): ScheduleSave {
  const utils = trpc.useUtils();
  return trpc.admissions.placementSchedule.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classRecords.invalidate(),
        utils.students.pendingActions.invalidate(),
      ]);
      onClose();
    },
  });
}

function useScheduleActions(input: {
  props: ScheduleProps;
  state: ScheduleState;
  calendar: ScheduleCalendarData;
  validation: ScheduleValidation;
}): ScheduleActions {
  const { props, state, calendar, validation } = input;
  const { candidate, onClose, registration } = props;
  const { dirty, discarding, setDiscarding, id, draft } = state;
  const errors = useLeadErrors();
  const save = useScheduleSave(onClose);
  const pending = save.isPending || Boolean(registration?.pending);
  const edits = useScheduleEdits({ props, state, errors, save, pending });
  function requestClose(): void {
    if (pending || discarding) return;
    if (!registration && dirty) setDiscarding(true);
    else onClose();
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (pending) return;
    if (!validation.parsedDate) {
      errors.report([{ path: ["date"], message: "Informe uma data válida: dd/mm/aaaa." }]);
      return;
    }
    const parsed = placementScheduleSchema.safeParse({
      id,
      candidateId: candidate.id,
      ...draft,
      date: validation.parsedDate,
    });
    if (!parsed.success) return errors.report(parsed.error.issues);
    const message = validation.intervalError(parsed.data);
    if (message) return errors.report([{ path: ["schedule"], message }]);
    if (registration) registration.onConfirm(parsed.data);
    else save.mutate(parsed.data);
  }
  const message =
    validation.selectionError ||
    errors.fields.schedule ||
    (calendar.pendingPlacement ? "Este lead já tem um nivelamento agendado." : undefined);
  return { errors, save, pending, requestClose, ...edits, submit, message };
}

export type ScheduleViewProps = {
  props: ScheduleProps;
  state: ScheduleState;
  calendar: ScheduleCalendarData;
  validation: ScheduleValidation;
  actions: ScheduleActions;
};

export function PlacementSchedule({
  candidate,
  onClose,
  registration,
}: ScheduleProps): ReactJSX.Element {
  const props: ScheduleProps = { candidate, onClose, ...(registration ? { registration } : {}) };
  const state = useScheduleState(props);
  const calendar = useScheduleCalendar(props, state);
  const validation = scheduleValidation(state, calendar);
  const actions = useScheduleActions({ props, state, calendar, validation });
  return <PlacementScheduleView {...{ props, state, calendar, validation, actions }} />;
}
