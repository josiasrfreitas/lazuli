"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  appointmentRecordSchema,
  type MakeupCoverageInput,
  type AppointmentSnapshot,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { useValidation } from "~/features/shared/task-form";
import { useAppointmentRefresh, type Appointment } from "./shared";
const MS_PER_MINUTE = 60_000;
export type RecordFormProps = {
  data: Appointment;
  onClose: () => void;
  context?: ReactNode;
  footerTarget?: HTMLElement | null;
  onPendingChange?: (pending: boolean) => void;
};
type RecordDraft = {
  attended: boolean;
  content: string;
  minutes: string;
  coverages: MakeupCoverageInput[];
  notes: string;
  reason: string;
};
export type RecordModel = {
  opened: Appointment;
  draft: RecordDraft;
  correcting: boolean;
  validation: ReturnType<typeof useValidation>;
  save: ReturnType<typeof trpc.appointments.record.useMutation>;
  edit: (patch: Partial<RecordDraft>, error?: string) => void;
  submit: () => void;
};
function initialDraft(snapshot: AppointmentSnapshot): RecordDraft {
  const plannedMinutes =
    (new Date(`1970-01-01T${snapshot.endTime}:00Z`).getTime() -
      new Date(`1970-01-01T${snapshot.startTime}:00Z`).getTime()) /
    MS_PER_MINUTE;
  return {
    attended: snapshot.status !== "NO_SHOW",
    content: snapshot.performedContent ?? "",
    minutes: String(snapshot.performedMinutes ?? plannedMinutes),
    coverages: snapshot.coverages
      .filter((row) => row.applicable)
      .map((row) => ({ attendanceId: row.attendanceId, minutes: row.minutes })),
    notes: snapshot.notes ?? "",
    reason: "",
  };
}
export function useAppointmentRecord(props: RecordFormProps): RecordModel {
  const [opened] = useState(props.data);
  const [draft, setDraft] = useState(() => initialDraft(opened.snapshot));
  const correcting = opened.snapshot.status !== "SCHEDULED";
  const validation = useValidation();
  const refresh = useAppointmentRefresh();
  const save = trpc.appointments.record.useMutation({
    onSuccess: async () => {
      await refresh();
      props.onClose();
    },
  });
  useEffect(() => document.querySelector<HTMLElement>("#appointment-attended")?.focus(), []);
  useEffect(() => props.onPendingChange?.(save.isPending), [save.isPending, props.onPendingChange]);
  function submit(): void {
    const schema = appointmentRecordSchema.refine(
      (value) => !correcting || Boolean(value.reason.trim()),
      {
        path: ["reason"],
        message: "Explique o motivo da correção.",
      },
    );
    const parsed = validation.validate(schema, recordInput(opened.snapshot, draft));
    if (parsed && !save.isPending) save.mutate(parsed);
  }
  function edit(patch: Partial<RecordDraft>, error?: string): void {
    setDraft((current) => ({ ...current, ...patch }));
    if (error) validation.clear(error);
  }
  return { opened, draft, correcting, validation, save, edit, submit };
}
function recordInput(snapshot: AppointmentSnapshot, draft: RecordDraft): object {
  return {
    id: snapshot.id,
    expectedVersion: snapshot.version,
    attended: draft.attended,
    performedContent: draft.attended ? draft.content : "",
    performedMinutes: draft.attended ? Number(draft.minutes) : null,
    notes: draft.notes,
    reason: draft.reason,
    coverages: draft.attended ? draft.coverages : [],
  };
}
