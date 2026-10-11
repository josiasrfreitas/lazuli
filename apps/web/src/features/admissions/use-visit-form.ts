"use client";
import { useState, type FormEvent } from "react";
import { entryVisitScheduleSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { useValidation } from "~/features/shared/task-form";
import { initialVisitDraft, visitMeetingInput, type VisitDraft } from "./visit-model";
import type { Candidate } from "./labels";
export type VisitInput = { candidate: Candidate; previousVisitId?: string; onClose: () => void };
function useVisitDraft(candidate: Candidate, previousId?: string) {
  const [draft, setDraft] = useState(() => initialVisitDraft(candidate, previousId));
  const validation = useValidation();
  const change = <Key extends keyof VisitDraft>(key: Key, value: VisitDraft[Key]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "date" || key === "classId" ? { meetingKey: "" } : {}),
    }));
    validation.clear(key);
    validation.clear(key === "teacher" ? "meeting.teacherId" : `meeting.${key}`);
    if (key === "kind" || key === "date" || key === "classId" || key === "meetingKey")
      validation.clear("meeting");
  };
  return { draft, change, validation };
}
function useVisitOptions(candidate: Candidate, draft: VisitDraft) {
  const parsedDate = parseDateBR(draft.date);
  const classes = trpc.admissions.matches.useQuery(
    { id: candidate.id, date: parsedDate ?? candidate.today },
    { enabled: draft.kind === "TRIAL" && Boolean(parsedDate), retry: false },
  );
  const meetings = trpc.admissions.meetings.useQuery(
    { id: candidate.id, date: parsedDate ?? candidate.today, classId: draft.classId },
    { enabled: draft.kind === "TRIAL" && Boolean(parsedDate && draft.classId), retry: false },
  );
  return { parsedDate, classes, meetings };
}
export type VisitOptions = ReturnType<typeof useVisitOptions>;
function useVisitMutation(onClose: () => void) {
  const utils = trpc.useUtils();
  return trpc.admissions.schedule.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admissions.invalidate(), utils.teachers.invalidate()]);
      onClose();
    },
  });
}
export function useVisitForm({ candidate, previousVisitId, onClose }: VisitInput) {
  const [id] = useState(() => crypto.randomUUID());
  const state = useVisitDraft(candidate, previousVisitId);
  const options = useVisitOptions(candidate, state.draft);
  const mutation = useVisitMutation(onClose);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || (state.draft.kind === "TRIAL" && options.meetings.isFetching)) return;
    const values = state.validation.validate(entryVisitScheduleSchema, {
      id,
      candidateId: candidate.id,
      date: options.parsedDate ?? "",
      notes: state.draft.notes,
      ...(previousVisitId ? { previousVisitId } : {}),
      meeting: visitMeetingInput(state.draft, candidate.format, options.meetings.data ?? []),
    });
    if (values) mutation.mutate(values);
  };
  const change: typeof state.change = (key, value) => {
    state.change(key, value);
    if (!mutation.isPending) mutation.reset();
  };
  return { ...state, change, options, mutation, submit };
}
