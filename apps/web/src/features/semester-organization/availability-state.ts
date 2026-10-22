"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { z, classScheduleSlotInputSchema, studentAvailabilitySchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useValidation } from "~/features/shared/task-form";
import {
  dateOnly,
  useOrganizationRefresh,
  type SemesterBoard,
  type StudentContext,
} from "./shared";
import type { SlotDraft } from "./slot-fields";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;
type Availability = StudentContext["availability"][number];

export type AvailabilityState = {
  current: Availability | undefined;
  hasPrevious: boolean;
  slots: SlotDraft[];
  changeSlots: (slots: SlotDraft[]) => void;
  until: string;
  changeUntil: (value: string) => void;
  format: string;
  setFormat: (value: string) => void;
  notes: string;
  changeNotes: (value: string) => void;
  pending: boolean;
  error: string | undefined;
  validation: ReturnType<typeof useValidation>;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

type AvailabilityDraft = {
  current: Availability | undefined;
  hasPrevious: boolean;
  slots: SlotDraft[];
  setSlots: Dispatch<SetStateAction<SlotDraft[]>>;
  until: string;
  setUntil: Dispatch<SetStateAction<string>>;
  format: string;
  setFormat: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
};
type AvailabilityChanges = Pick<AvailabilityState, "changeUntil" | "changeSlots" | "changeNotes">;
type AvailabilityInitial = Pick<
  AvailabilityDraft,
  "current" | "hasPrevious" | "slots" | "until" | "format" | "notes"
>;

export function useAvailabilityState({
  data,
  board,
  onClose,
}: {
  data: StudentContext;
  board: SemesterBoard;
  onClose: () => void;
}): AvailabilityState {
  const draft = useAvailabilityDraft(data, board);
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.confirmAvailability.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(
      studentAvailabilitySchema,
      availabilityInput({ data, board, draft }),
    );
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  const changes = availabilityChangeHandlers(draft, validation);
  return {
    current: draft.current,
    hasPrevious: draft.hasPrevious,
    slots: draft.slots,
    changeSlots: changes.changeSlots,
    until: draft.until,
    changeUntil: changes.changeUntil,
    format: draft.format,
    setFormat: draft.setFormat,
    notes: draft.notes,
    changeNotes: changes.changeNotes,
    pending: mutation.isPending,
    error: mutation.error?.message,
    validation,
    submit,
  };
}

function availabilityInput({
  data,
  board,
  draft,
}: {
  data: StudentContext;
  board: SemesterBoard;
  draft: AvailabilityDraft;
}): {
  semesterId: string;
  studentId: string;
  previousId: string | null;
  validUntil: string;
  formats: string[];
  slots: SlotDraft[];
  notes: string;
} {
  return {
    semesterId: board.semester.id,
    studentId: data.student.id,
    previousId: draft.current?.id ?? null,
    validUntil: parseDateBR(draft.until) ?? "",
    formats: draft.format === "BOTH" ? ["IN_PERSON", "ONLINE"] : [draft.format],
    slots: draft.slots,
    notes: draft.notes,
  };
}

function availabilityChangeHandlers(
  draft: AvailabilityDraft,
  validation: ReturnType<typeof useValidation>,
): AvailabilityChanges {
  return {
    changeUntil: (value) => {
      draft.setUntil(maskDateBR(value));
      validation.clear("validUntil");
    },
    changeSlots: (value) => {
      draft.setSlots(value);
      validation.clear("slots");
    },
    changeNotes: (value) => {
      draft.setNotes(value);
      validation.clear("notes");
    },
  };
}

function useAvailabilityDraft(data: StudentContext, board: SemesterBoard): AvailabilityDraft {
  const initial = initialAvailability(data, board);
  const [slots, setSlots] = useState<SlotDraft[]>(initial.slots);
  const [until, setUntil] = useState(initial.until);
  const [format, setFormat] = useState(initial.format);
  const [notes, setNotes] = useState(initial.notes);
  return {
    current: initial.current,
    hasPrevious: initial.hasPrevious,
    slots,
    setSlots,
    until,
    setUntil,
    format,
    setFormat,
    notes,
    setNotes,
  };
}

function initialAvailability(data: StudentContext, board: SemesterBoard): AvailabilityInitial {
  const current = data.availability[0];
  const previous = current ?? data.previousAvailability;
  const slots = initialAvailabilitySlots(data, previous);
  const until = formatDateOnlyBR(dateOnly(current?.validUntil ?? board.semester.endDate));
  const format = initialFormat(data, previous);
  const notes = previous?.notes ?? "";
  return {
    current,
    hasPrevious: Boolean(previous || data.lead?.availability.length),
    slots,
    until,
    format,
    notes,
  };
}

function initialFormat(
  data: StudentContext,
  previous: Availability | StudentContext["previousAvailability"],
): string {
  const formats = previous?.formats ?? (data.lead?.format ? [data.lead.format] : ["IN_PERSON"]);
  return formats.length === 2 ? "BOTH" : (formats[0] ?? "IN_PERSON");
}

function initialAvailabilitySlots(
  data: StudentContext,
  previous: Availability | StudentContext["previousAvailability"],
): SlotDraft[] {
  const prefilled = z.array(classScheduleSlotInputSchema).safeParse(previous?.slots);
  if (prefilled.success) return prefilled.data;
  const leadSlots = data.lead?.availability.map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  }));
  return leadSlots?.length ? leadSlots : [{ weekday: "MONDAY", startTime: "", endTime: "" }];
}
