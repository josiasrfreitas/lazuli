"use client";

import {
  useState,
  useSyncExternalStore,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CalendarView } from "@lazuli/ui";
import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import { occurrenceCreateSchema } from "@lazuli/validators";
import { monday, schoolToday, shiftDate } from "~/features/class-records/calendar-model";
import { useValidation } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { occurrenceCalendarHours } from "./occurrence-calendar-hours";
import { studentFollowUpHref } from "./student-navigation";

const WEEK_END_OFFSET = 6;
export type OccurrenceStudent = { id: string; name: string };
export type OccurrenceFormProps = {
  onClose: () => void;
  student?: OccurrenceStudent | undefined;
  onCreated?: ((id: string) => void) | undefined;
};
export type OccurrenceValues = {
  classSessionId: string;
  studentId: string;
  category: string;
  title: string;
  account: string;
  initialResponse: string;
};
type QueryModel<T> = {
  data: T | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
};
type SaveModel = {
  isPending: boolean;
  error: { message: string } | null;
  mutate: (input: RouterInputs["occurrences"]["create"]) => void;
  reset: () => void;
};
export type OccurrenceFormModel = {
  student: OccurrenceStudent | undefined;
  mobileList: boolean;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  view: CalendarView;
  setView: Dispatch<SetStateAction<CalendarView>>;
  values: OccurrenceValues;
  validation: ReturnType<typeof useValidation>;
  from: string;
  sessions: QueryModel<RouterOutputs["occurrences"]["sessions"]>;
  roster: QueryModel<RouterOutputs["occurrences"]["roster"]>;
  selected: RouterOutputs["occurrences"]["sessions"][number] | undefined;
  hours: ReturnType<typeof occurrenceCalendarHours>;
  calendarBusy: boolean;
  canSubmit: boolean;
  save: SaveModel;
  change: (name: keyof OccurrenceValues, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};
type OccurrenceData = Pick<
  OccurrenceFormModel,
  "from" | "sessions" | "roster" | "selected" | "hours" | "calendarBusy" | "canSubmit"
>;

export function useOccurrenceFormModel({
  onClose,
  student,
  onCreated,
}: OccurrenceFormProps): OccurrenceFormModel {
  const mobileList = useTeacherMobileList();
  const [date, setDate] = useState(schoolToday);
  const [view, setView] = useState<CalendarView>("day");
  const [values, setValues] = useState<OccurrenceValues>(() => initialValues(student));
  const validation = useValidation();
  const data = useOccurrenceData({ student, date, view, values, mobileList });
  const save = useOccurrenceSave({ onClose, onCreated });
  function change(name: keyof OccurrenceValues, value: string): void {
    if (save.isPending) return;
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "classSessionId" ? { studentId: student?.id ?? "" } : {}),
    }));
    validation.clear(name);
    if (name === "classSessionId") validation.clear("studentId");
    save.reset();
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (save.isPending || !data.canSubmit) return;
    const parsed = validation.validate(occurrenceCreateSchema, values);
    if (parsed) save.mutate(parsed);
  }
  return {
    student,
    mobileList,
    date,
    setDate,
    view,
    setView,
    values,
    validation,
    ...data,
    save,
    change,
    submit,
  };
}

function initialValues(student: OccurrenceStudent | undefined): OccurrenceValues {
  return {
    classSessionId: "",
    studentId: student?.id ?? "",
    category: "LEARNING",
    title: "",
    account: "",
    initialResponse: "",
  };
}

function useOccurrenceData({
  student,
  date,
  view,
  values,
  mobileList,
}: {
  student: OccurrenceStudent | undefined;
  date: string;
  view: CalendarView;
  values: OccurrenceValues;
  mobileList: boolean;
}): OccurrenceData {
  const from = view === "week" ? monday(date) : date;
  const sessions = useOccurrenceSessions({ student, from, date, view, mobileList });
  const roster = trpc.occurrences.roster.useQuery(
    { id: values.classSessionId },
    { enabled: !student && Boolean(values.classSessionId) },
  );
  const selected = sessions.data?.find((row) => row.id === values.classSessionId);
  const hours = occurrenceCalendarHours(sessions.data ?? []);
  const calendarBusy = [sessions.isPending, sessions.isFetching].some(Boolean);
  const ready = rosterReady({ student, roster, studentId: values.studentId });
  const canSubmit = Boolean(selected) && !calendarBusy && !sessions.isError && ready;
  return { from, sessions, roster, selected, hours, calendarBusy, canSubmit };
}

function useOccurrenceSessions({
  student,
  from,
  date,
  view,
  mobileList,
}: {
  student: OccurrenceStudent | undefined;
  from: string;
  date: string;
  view: CalendarView;
  mobileList: boolean;
}): OccurrenceFormModel["sessions"] {
  const studentFilter = student ? { studentId: student.id } : {};
  const calendarSessions = trpc.occurrences.sessions.useQuery(
    {
      ...studentFilter,
      range: { from, to: view === "week" ? shiftDate(from, WEEK_END_OFFSET) : date },
    },
    { enabled: !mobileList },
  );
  const recentSessions = trpc.occurrences.sessions.useQuery(studentFilter, { enabled: mobileList });
  return mobileList ? recentSessions : calendarSessions;
}

const MOBILE_QUERY = "(max-width: 959px)";
function useTeacherMobileList(): boolean {
  const pathname = usePathname();
  const narrow = useSyncExternalStore(subscribeNarrow, narrowSnapshot, () => false);
  return pathname.startsWith("/professor/") && narrow;
}
function subscribeNarrow(callback: () => void): () => void {
  const media = globalThis.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function narrowSnapshot(): boolean {
  return globalThis.matchMedia(MOBILE_QUERY).matches;
}

function rosterReady({
  student,
  roster,
  studentId,
}: {
  student: OccurrenceStudent | undefined;
  roster: QueryModel<RouterOutputs["occurrences"]["roster"]>;
  studentId: string;
}): boolean {
  if (student) return true;
  return Boolean(
    roster.data?.some((row) => row.id === studentId) && !roster.isError && !roster.isFetching,
  );
}

function useOccurrenceSave({
  onClose,
  onCreated,
}: Pick<OccurrenceFormProps, "onClose" | "onCreated">): SaveModel {
  const router = useRouter();
  const utils = trpc.useUtils();
  const save = trpc.occurrences.create.useMutation({
    onSuccess: async (result, submitted) => {
      await Promise.all([utils.occurrences.invalidate(), utils.dashboard.invalidate()]);
      onClose();
      if (onCreated) onCreated(result.id);
      else
        router.push(
          studentFollowUpHref(submitted.studentId, { kind: "occurrence", id: result.id }),
        );
    },
  });
  return save;
}
