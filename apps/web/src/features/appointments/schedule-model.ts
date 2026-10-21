"use client";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  appointmentScheduleSchema,
  appointmentRescheduleSchema,
  type AppointmentSnapshot,
  type MakeupCoverageInput,
  type z,
} from "@lazuli/validators";
import type { SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { useValidation } from "~/features/shared/task-form";
import { today, useAppointmentRefresh, type Absence } from "./shared";
import type { ScheduleSelection } from "./meeting-types";
export type ScheduleProps = {
  student?: { id: string; name: string };
  source?: Absence;
  previous?: AppointmentSnapshot;
  onClose: () => void;
};
type ScheduleDraft = {
  id: string;
  student: SearchSelectOption | null;
  search: string;
  step: "details" | "schedule";
  purpose: AppointmentSnapshot["purpose"];
  kind: "CLASS" | "INDEPENDENT";
  date: string;
  sessionId: string;
  teacherSelection: SearchSelectOption | null | undefined;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
  planned: string;
  notes: string;
  reason: string;
  coverages: MakeupCoverageInput[];
};
type StudentOptions = RouterOutputs["appointments"]["student"];
type SearchResults = RouterOutputs["students"]["search"];
type Queries = {
  options: ReturnType<typeof trpc.appointments.student.useQuery<StudentOptions>>;
  results: ReturnType<typeof trpc.students.search.useQuery<SearchResults>>;
};
type Eligibility = {
  activePptEnrollment: StudentOptions["enrollments"][number] | undefined;
  teacher: SearchSelectOption | null;
  parsedDate: string | null;
  noMakeupSources: boolean;
  noPptEnrollment: boolean;
  noCurrentEnrollment: boolean;
  unavailable: boolean;
  enrollmentDateError: string | undefined;
};
type Saving = {
  schedule: ReturnType<typeof trpc.appointments.schedule.useMutation>;
  reschedule: ReturnType<typeof trpc.appointments.reschedule.useMutation>;
};
type ScheduleState = {
  props: ScheduleProps;
  draft: ScheduleDraft;
  queries: Queries;
  eligibility: Eligibility;
  saving: Saving;
  validation: ReturnType<typeof useValidation>;
  pending: boolean;
  selectionReady: boolean;
  setSelectionReady: (ready: boolean) => void;
  edit: (patch: Partial<ScheduleDraft>, error?: string) => void;
};
export type ScheduleModel = ScheduleState & { submit: () => void };
function initialDraft(props: ScheduleProps): ScheduleDraft {
  const student = props.student ?? props.previous?.student;
  return {
    id: crypto.randomUUID(),
    student: student ? { id: student.id, label: student.name } : null,
    search: "",
    step: "details",
    ...initialMeeting(props.previous),
    ...initialDetails(props),
  };
}
function initialMeeting(
  previous: AppointmentSnapshot | undefined,
): Pick<
  ScheduleDraft,
  "kind" | "date" | "sessionId" | "teacherSelection" | "startTime" | "endTime" | "format"
> {
  if (previous)
    return {
      kind: previous.targetClassSessionId ? "CLASS" : "INDEPENDENT",
      date: formatDateOnlyBR(previous.date),
      sessionId: previous.targetClassSessionId ?? "",
      teacherSelection: initialTeacher(previous),
      startTime: previous.startTime,
      endTime: previous.endTime,
      format: previous.format,
    };
  return {
    kind: "INDEPENDENT",
    date: formatDateOnlyBR(today()),
    sessionId: "",
    teacherSelection: undefined,
    startTime: "",
    endTime: "",
    format: "IN_PERSON",
  };
}
function initialDetails(
  props: ScheduleProps,
): Pick<ScheduleDraft, "purpose" | "planned" | "notes" | "reason" | "coverages"> {
  return {
    purpose: props.previous?.purpose ?? "MAKEUP",
    planned: props.previous?.plannedContent ?? "",
    notes: props.previous?.notes ?? "",
    reason: "",
    coverages: initialCoverages(props),
  };
}
function initialCoverages({ source, previous }: ScheduleProps): MakeupCoverageInput[] {
  if (source) return [{ attendanceId: source.id, minutes: source.available }];
  return (
    previous?.coverages.map((row) => ({ attendanceId: row.attendanceId, minutes: row.minutes })) ??
    []
  );
}
function initialTeacher(
  previous: AppointmentSnapshot | undefined,
): ScheduleDraft["teacherSelection"] {
  if (!previous) return undefined;
  return previous.teacher ? { id: previous.teacher.id, label: previous.teacher.name } : null;
}
function useScheduleQueries(draft: ScheduleDraft, props: ScheduleProps): Queries {
  const results = trpc.students.search.useQuery(
    { query: draft.search },
    { enabled: !props.student && !props.previous && draft.search.length >= 2 },
  );
  const options = trpc.appointments.student.useQuery(
    {
      studentId: draft.student?.id ?? "",
      ...(props.previous ? { excludeAppointmentId: props.previous.id } : {}),
    },
    { enabled: Boolean(draft.student), retry: false },
  );
  return { results, options };
}
function useSaving(onClose: () => void): Saving {
  const refresh = useAppointmentRefresh();
  async function saved(): Promise<void> {
    await refresh();
    onClose();
  }
  const schedule = trpc.appointments.schedule.useMutation({ onSuccess: saved });
  const reschedule = trpc.appointments.reschedule.useMutation({ onSuccess: saved });
  return { schedule, reschedule };
}
export function useScheduleModel(props: ScheduleProps): ScheduleModel {
  const [draft, setDraft] = useState(() => initialDraft(props));
  const [selectionReady, setSelectionReady] = useState(false);
  const validation = useValidation();
  const queries = useScheduleQueries(draft, props);
  const saving = useSaving(props.onClose);
  const eligibility = studentEligibility(draft, queries.options);
  function edit(patch: Partial<ScheduleDraft>, error?: string): void {
    setDraft((current) => ({ ...current, ...patch }));
    if (error) validation.clear(error);
  }
  const model: ScheduleState = {
    props,
    draft,
    queries,
    saving,
    eligibility,
    validation,
    selectionReady,
    setSelectionReady,
    edit,
    pending: saving.schedule.isPending || saving.reschedule.isPending,
  };
  return { ...model, submit: () => submitSchedule(model) };
}
function studentEligibility(draft: ScheduleDraft, options: Queries["options"]): Eligibility {
  const currentDate = today();
  const activePptEnrollment = options.data?.enrollments.find(
    (row) =>
      row.scheduleType === "PERSONALIZED" &&
      row.entryDate <= currentDate &&
      (!row.exitDate || row.exitDate > currentDate),
  );
  const restrictions = studentRestrictions(draft, {
    options,
    hasPpt: Boolean(activePptEnrollment),
  });
  const unavailable = studentUnavailable(options, {
    ...restrictions,
    student: Boolean(draft.student),
  });
  const parsedDate = parseDateBR(draft.date);
  return {
    activePptEnrollment,
    teacher: selectedTeacher(draft.teacherSelection, options.data?.defaultTeacher),
    parsedDate,
    ...restrictions,
    unavailable,
    enrollmentDateError: pptDateError(draft, { activePptEnrollment, parsedDate }),
  };
}
type StudentRestrictions = Pick<
  Eligibility,
  "noMakeupSources" | "noPptEnrollment" | "noCurrentEnrollment"
>;
function studentRestrictions(
  draft: ScheduleDraft,
  { options, hasPpt }: { options: Queries["options"]; hasPpt: boolean },
): StudentRestrictions {
  const sources = options.data?.absences.some(
    (row) =>
      row.available > 0 || draft.coverages.some((coverage) => coverage.attendanceId === row.id),
  );
  const studentReady = Boolean(draft.student) && options.isSuccess;
  return {
    noMakeupSources: draft.purpose === "MAKEUP" && studentReady && !sources,
    noPptEnrollment: draft.purpose === "PPT_COMPLEMENT" && studentReady && !hasPpt,
    noCurrentEnrollment: options.isSuccess && !options.data.hasCurrentEnrollment,
  };
}
function studentUnavailable(
  options: Queries["options"],
  restrictions: StudentRestrictions & { student: boolean },
): boolean {
  return (
    restrictions.student &&
    (options.isPending ||
      options.isError ||
      restrictions.noCurrentEnrollment ||
      restrictions.noMakeupSources ||
      restrictions.noPptEnrollment)
  );
}

function selectedTeacher(
  selection: ScheduleDraft["teacherSelection"],
  defaultTeacher: StudentOptions["defaultTeacher"] | undefined,
): SearchSelectOption | null {
  if (selection !== undefined) return selection;
  return defaultTeacher ? { id: defaultTeacher.id, label: defaultTeacher.name } : null;
}
function pptDateError(
  draft: ScheduleDraft,
  state: Pick<Eligibility, "activePptEnrollment" | "parsedDate">,
): string | undefined {
  const { activePptEnrollment, parsedDate } = state;
  if (
    draft.step !== "schedule" ||
    draft.purpose !== "PPT_COMPLEMENT" ||
    !activePptEnrollment ||
    !parsedDate
  )
    return undefined;
  if (
    activePptEnrollment.entryDate > parsedDate ||
    (activePptEnrollment.exitDate && activePptEnrollment.exitDate <= parsedDate)
  )
    return "A matrícula PPT atual não está vigente neste dia. Escolha outra data.";
  return undefined;
}
function scheduleInput(model: ScheduleState): z.input<typeof appointmentScheduleSchema> {
  const { draft, eligibility, props } = model;
  return {
    id: draft.id,
    studentId: draft.student?.id ?? "",
    purpose: draft.purpose,
    enrollmentId:
      draft.purpose === "PPT_COMPLEMENT"
        ? (eligibility.activePptEnrollment?.id ?? null)
        : (props.previous?.enrollmentId ?? null),
    plannedContent: draft.planned,
    notes: draft.notes,
    coverages: draft.purpose === "MAKEUP" ? draft.coverages : [],
    meeting: meetingInput(model),
  };
}
function meetingInput({
  draft,
  eligibility,
}: ScheduleState): z.input<typeof appointmentScheduleSchema>["meeting"] {
  if (draft.kind === "CLASS") return { kind: draft.kind, sessionId: draft.sessionId };
  return {
    kind: draft.kind,
    teacherId: eligibility.teacher?.id ?? "",
    date: eligibility.parsedDate ?? "",
    startTime: draft.startTime,
    endTime: draft.endTime,
    format: draft.format,
  };
}

function advanceSchedule(model: ScheduleState): void {
  const valid = model.validation.validateFields(appointmentScheduleSchema, {
    values: scheduleInput(model),
    fields: ["studentId", "purpose", "enrollmentId", "plannedContent", "notes", "coverages"],
  });
  if (!valid) return;
  if (
    model.props.previous &&
    !model.validation.validate(appointmentRescheduleSchema.pick({ reason: true }), {
      reason: model.draft.reason,
    })
  )
    return;
  model.setSelectionReady(false);
  model.edit({ step: "schedule" });
}
function submitSchedule(model: ScheduleState): void {
  if (model.pending || model.eligibility.unavailable) return;
  if (model.draft.step === "details") {
    advanceSchedule(model);
    return;
  }
  if (model.eligibility.enrollmentDateError || !model.selectionReady) return;
  const values = model.validation.validate(appointmentScheduleSchema, scheduleInput(model));
  if (!values) return;
  const previous = model.props.previous;
  if (previous) {
    const replacement = model.validation.validate(appointmentRescheduleSchema, {
      id: previous.id,
      expectedVersion: previous.version,
      reason: model.draft.reason,
      replacement: values,
    });
    if (replacement) model.saving.reschedule.mutate(replacement);
  } else model.saving.schedule.mutate(values);
}
export function changeScheduleTeacher(
  model: ScheduleModel,
  teacher: SearchSelectOption | null,
): void {
  model.edit({ teacherSelection: teacher, sessionId: "", startTime: "", endTime: "" }, "meeting");
}
export function changeScheduleDate(model: ScheduleModel, date: string): void {
  model.setSelectionReady(false);
  model.edit({ date: formatDateOnlyBR(date), sessionId: "" }, "meeting");
}
export function chooseMeeting(model: ScheduleModel, value: ScheduleSelection): void {
  model.edit(
    {
      date: formatDateOnlyBR(value.date),
      startTime: value.startTime,
      endTime: value.endTime,
      sessionId: value.sessionId ?? "",
      ...(value.format ? { format: value.format } : {}),
    },
    "meeting",
  );
}
export function changeMeetingKind(model: ScheduleModel, kind: ScheduleDraft["kind"]): void {
  model.edit({ kind, sessionId: "", startTime: "", endTime: "" }, "meeting");
  model.setSelectionReady(false);
}
