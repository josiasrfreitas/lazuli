"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  appointmentScheduleSchema,
  appointmentRescheduleSchema,
  type AppointmentSnapshot,
  type MakeupCoverageInput,
  type z,
} from "@lazuli/validators";
import type { CalendarInterval, SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { useValidation } from "~/features/shared/task-form";
import { today, useAppointmentRefresh, type Absence } from "./shared";

export type ScheduleDialogProps = {
  student?: { id: string; name: string };
  initialDate?: string;
  initialSelection?: CalendarInterval | undefined;
  source?: Absence;
  previous?: AppointmentSnapshot;
  onClose: () => void;
};
export type DraftValues = {
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
  selectionReady: boolean;
  planned: string;
  notes: string;
  reason: string;
  coverages: MakeupCoverageInput[];
};
export type DraftState = {
  values: DraftValues;
  update: Dispatch<SetStateAction<DraftValues>>;
  change: <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => void;
  validation: ReturnType<typeof useValidation>;
};
type StudentOptions = RouterOutputs["appointments"]["student"];
type StudentSearch = RouterOutputs["students"]["search"];
export type ScheduleData = {
  options: StudentOptions | undefined;
  optionsPending: boolean;
  optionsError: { message: string } | null;
  optionsSuccess: boolean;
  retryOptions: () => void;
  results: StudentSearch | undefined;
  resultsFetching: boolean;
  teacher: SearchSelectOption | null;
  parsedDate: string | null;
  activePptEnrollment: StudentOptions["enrollments"][number] | undefined;
  noMakeupSources: boolean;
  noPptEnrollment: boolean;
  noCurrentEnrollment: boolean;
  unavailable: boolean;
  enrollmentDateError: string | undefined;
};
export type ScheduleSubmission = {
  pending: boolean;
  error: string | undefined;
  submit: () => void;
};
export type ScheduleModel = {
  input: ScheduleDialogProps;
  draft: DraftState;
  data: ScheduleData;
  submission: ScheduleSubmission;
};

function initialPeople({
  student,
  previous,
}: ScheduleDialogProps): Pick<DraftValues, "student" | "teacherSelection"> {
  let selectedStudent: SearchSelectOption | null = null;
  if (student) selectedStudent = { id: student.id, label: student.name };
  else if (previous) selectedStudent = { id: previous.student.id, label: previous.student.name };
  let teacherSelection: SearchSelectOption | null | undefined = undefined;
  if (previous) {
    teacherSelection = previous.teacher
      ? { id: previous.teacher.id, label: previous.teacher.name }
      : null;
  }
  return { student: selectedStudent, teacherSelection };
}

function initialMeeting(
  previous: AppointmentSnapshot | undefined,
): Pick<DraftValues, "kind" | "sessionId" | "startTime" | "endTime" | "format"> {
  if (!previous)
    return { kind: "INDEPENDENT", sessionId: "", startTime: "", endTime: "", format: "IN_PERSON" };
  return {
    kind: previous.targetClassSessionId ? "CLASS" : "INDEPENDENT",
    sessionId: previous.targetClassSessionId ?? "",
    startTime: previous.startTime,
    endTime: previous.endTime,
    format: previous.format,
  };
}

function initialCoverages(
  source: Absence | undefined,
  previous: AppointmentSnapshot | undefined,
): MakeupCoverageInput[] {
  if (source) return [{ attendanceId: source.id, minutes: source.available }];
  if (previous)
    return previous.coverages.map((row) => ({
      attendanceId: row.attendanceId,
      minutes: row.minutes,
    }));
  return [];
}

function initialDetails({
  source,
  previous,
  initialDate,
}: ScheduleDialogProps): Pick<DraftValues, "purpose" | "date" | "planned" | "notes" | "coverages"> {
  const coverages = initialCoverages(source, previous);
  if (!previous)
    return {
      purpose: "MAKEUP",
      date: formatDateOnlyBR(initialDate ?? today()),
      planned: "",
      notes: "",
      coverages,
    };
  return {
    purpose: previous.purpose,
    date: formatDateOnlyBR(previous.date),
    planned: previous.plannedContent ?? "",
    notes: previous.notes ?? "",
    coverages,
  };
}

function initialDraft(input: ScheduleDialogProps): DraftValues {
  return {
    id: crypto.randomUUID(),
    search: "",
    step: "details",
    selectionReady: false,
    reason: "",
    ...initialPeople(input),
    ...initialMeeting(input.previous),
    ...initialDetails(input),
    ...(input.initialSelection
      ? {
          date: formatDateOnlyBR(input.initialSelection.date),
          startTime: input.initialSelection.startTime,
          endTime: input.initialSelection.endTime,
        }
      : {}),
  };
}

function useScheduleDraft(input: ScheduleDialogProps): DraftState {
  const [values, update] = useState(() => initialDraft(input));
  const validation = useValidation();
  function change<K extends keyof DraftValues>(key: K, value: DraftValues[K]): void {
    update((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }
  return { values, update, change, validation };
}

function activePptEnrollment(
  options: StudentOptions | undefined,
): StudentOptions["enrollments"][number] | undefined {
  const currentDate = today();
  return options?.enrollments.find(
    (row) =>
      row.scheduleType === "PERSONALIZED" &&
      row.entryDate <= currentDate &&
      (!row.exitDate || row.exitDate > currentDate),
  );
}

function hasMakeupSources(
  options: StudentOptions | undefined,
  coverages: MakeupCoverageInput[],
): boolean {
  return Boolean(
    options?.absences.some(
      (row) => row.available > 0 || coverages.some((coverage) => coverage.attendanceId === row.id),
    ),
  );
}

function pptDateError({
  values,
  enrollment,
  parsedDate,
}: {
  values: DraftValues;
  enrollment: ScheduleData["activePptEnrollment"];
  parsedDate: string | null;
}): string | undefined {
  if (
    values.step !== "schedule" ||
    values.purpose !== "PPT_COMPLEMENT" ||
    !enrollment ||
    !parsedDate
  )
    return undefined;
  if (
    enrollment.entryDate > parsedDate ||
    (enrollment.exitDate && enrollment.exitDate <= parsedDate)
  )
    return "A matrícula PPT atual não está vigente neste dia. Escolha outra data.";
  return undefined;
}

type AvailabilityState = Pick<
  ScheduleData,
  | "activePptEnrollment"
  | "noMakeupSources"
  | "noPptEnrollment"
  | "noCurrentEnrollment"
  | "unavailable"
  | "enrollmentDateError"
>;

function lacksMakeupSources(
  values: DraftValues,
  {
    options,
    success,
  }: {
    options: StudentOptions | undefined;
    success: boolean;
  },
): boolean {
  if (values.purpose !== "MAKEUP" || !values.student || !success) return false;
  return !hasMakeupSources(options, values.coverages);
}

function lacksPptEnrollment(
  values: DraftValues,
  {
    enrollment,
    success,
  }: {
    enrollment: AvailabilityState["activePptEnrollment"];
    success: boolean;
  },
): boolean {
  return values.purpose === "PPT_COMPLEMENT" && Boolean(values.student) && success && !enrollment;
}

function scheduleUnavailable(
  values: DraftValues,
  flags: {
    pending: boolean;
    failed: boolean;
    noCurrentEnrollment: boolean;
    noMakeupSources: boolean;
    noPptEnrollment: boolean;
  },
): boolean {
  if (!values.student) return false;
  return (
    flags.pending ||
    flags.failed ||
    flags.noCurrentEnrollment ||
    flags.noMakeupSources ||
    flags.noPptEnrollment
  );
}

function scheduleAvailability({
  values,
  options,
  success,
  pending,
  failed,
  parsedDate,
}: {
  values: DraftValues;
  options: StudentOptions | undefined;
  success: boolean;
  pending: boolean;
  failed: boolean;
  parsedDate: string | null;
}): AvailabilityState {
  const enrollment = activePptEnrollment(options);
  const noMakeupSources = lacksMakeupSources(values, { options, success });
  const noPptEnrollment = lacksPptEnrollment(values, { enrollment, success });
  const noCurrentEnrollment = Boolean(success && !options?.hasCurrentEnrollment);
  const unavailable = scheduleUnavailable(values, {
    pending,
    failed,
    noCurrentEnrollment,
    noMakeupSources,
    noPptEnrollment,
  });
  return {
    activePptEnrollment: enrollment,
    noMakeupSources,
    noPptEnrollment,
    noCurrentEnrollment,
    unavailable,
    enrollmentDateError: pptDateError({ values, enrollment, parsedDate }),
  };
}

function useScheduleData(input: ScheduleDialogProps, draft: DraftState): ScheduleData {
  const values = draft.values;
  const results = trpc.students.search.useQuery(
    { query: values.search },
    { enabled: !input.student && !input.previous && values.search.length >= 2 },
  );
  const options = trpc.appointments.student.useQuery(
    {
      studentId: values.student?.id ?? "",
      ...(input.previous ? { excludeAppointmentId: input.previous.id } : {}),
    },
    { enabled: Boolean(values.student), retry: false },
  );
  const defaultTeacher = options.data?.defaultTeacher;
  let teacher: SearchSelectOption | null = values.teacherSelection ?? null;
  if (values.teacherSelection === undefined && defaultTeacher)
    teacher = { id: defaultTeacher.id, label: defaultTeacher.name };
  const parsedDate = parseDateBR(values.date);
  const availability = scheduleAvailability({
    values,
    options: options.data,
    success: options.isSuccess,
    pending: options.isPending,
    failed: options.isError,
    parsedDate,
  });
  return {
    options: options.data,
    optionsPending: options.isPending,
    optionsError: options.error,
    optionsSuccess: options.isSuccess,
    retryOptions: () => {
      void options.refetch();
    },
    results: results.data,
    resultsFetching: results.isFetching,
    teacher,
    parsedDate,
    ...availability,
  };
}

type AppointmentInput = z.input<typeof appointmentScheduleSchema>;

function draftMeeting(values: DraftValues, data: ScheduleData): AppointmentInput["meeting"] {
  if (values.kind === "CLASS") return { kind: "CLASS", sessionId: values.sessionId };
  return {
    kind: "INDEPENDENT",
    teacherId: data.teacher?.id ?? "",
    date: data.parsedDate ?? "",
    startTime: values.startTime,
    endTime: values.endTime,
    format: values.format,
  };
}

function draftEnrollmentId({
  input,
  draft,
  data,
}: Pick<ScheduleModel, "input" | "draft" | "data">): string | null {
  if (draft.values.purpose === "PPT_COMPLEMENT") return data.activePptEnrollment?.id ?? null;
  return input.previous?.enrollmentId ?? null;
}

function appointmentDraft({
  input,
  draft,
  data,
}: Pick<ScheduleModel, "input" | "draft" | "data">): AppointmentInput {
  const values = draft.values;
  return {
    id: values.id,
    studentId: values.student?.id ?? "",
    purpose: values.purpose,
    enrollmentId: draftEnrollmentId({ input, draft, data }),
    plannedContent: values.planned,
    notes: values.notes,
    coverages: values.purpose === "MAKEUP" ? values.coverages : [],
    meeting: draftMeeting(values, data),
  };
}

function validateDetails({
  input,
  draft,
  values,
  detailsStep,
}: {
  input: ScheduleDialogProps;
  draft: DraftState;
  values: AppointmentInput;
  detailsStep: "complete" | "nature";
}): boolean {
  if (
    !draft.validation.validateFields(appointmentScheduleSchema, {
      values,
      fields:
        detailsStep === "nature"
          ? ["studentId", "purpose", "enrollmentId", "coverages"]
          : ["studentId", "purpose", "enrollmentId", "plannedContent", "notes", "coverages"],
    })
  )
    return false;
  if (
    detailsStep === "complete" &&
    input.previous &&
    !draft.validation.validate(appointmentRescheduleSchema.pick({ reason: true }), {
      reason: draft.values.reason,
    })
  )
    return false;
  return true;
}

function useScheduleSubmission(
  { input, draft, data }: Pick<ScheduleModel, "input" | "draft" | "data">,
  detailsStep: "complete" | "nature",
): ScheduleSubmission {
  const refresh = useAppointmentRefresh();
  const saved = async (): Promise<void> => {
    await refresh();
    input.onClose();
  };
  const schedule = trpc.appointments.schedule.useMutation({ onSuccess: saved });
  const reschedule = trpc.appointments.reschedule.useMutation({ onSuccess: saved });
  const pending = schedule.isPending || reschedule.isPending;
  function submit(): void {
    if (pending || data.unavailable) return;
    const values = appointmentDraft({ input, draft, data });
    if (draft.values.step === "details") {
      if (!validateDetails({ input, draft, values, detailsStep })) return;
      draft.update((current) => ({ ...current, selectionReady: false, step: "schedule" }));
      return;
    }
    if (data.enrollmentDateError || !draft.values.selectionReady) return;
    const parsed = draft.validation.validate(appointmentScheduleSchema, values);
    if (!parsed) return;
    if (input.previous) {
      const replacement = draft.validation.validate(appointmentRescheduleSchema, {
        id: input.previous.id,
        expectedVersion: input.previous.version,
        reason: draft.values.reason,
        replacement: parsed,
      });
      if (replacement) reschedule.mutate(replacement);
    } else schedule.mutate(parsed);
  }
  return { pending, error: schedule.error?.message ?? reschedule.error?.message, submit };
}

export function useScheduleModel(
  input: ScheduleDialogProps,
  detailsStep: "complete" | "nature" = "complete",
): ScheduleModel {
  const draft = useScheduleDraft(input);
  const data = useScheduleData(input, draft);
  const submission = useScheduleSubmission({ input, draft, data }, detailsStep);
  return { input, draft, data, submission };
}
