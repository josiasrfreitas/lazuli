import type { RouterInputs, RouterOutputs } from "@lazuli/api";
import type { SearchSelectOption } from "@lazuli/ui";
import { dateLabel, type Candidate } from "./labels";
export type VisitMeeting = RouterOutputs["admissions"]["meetings"][number];
type MeetingReference = Pick<VisitMeeting, "slotId" | "sessionId">;
export type VisitDraft = {
  kind: "TRIAL" | "INTRODUCTION";
  date: string;
  classId: string;
  meetingKey: string;
  teacher: SearchSelectOption | null;
  startTime: string;
  endTime: string;
  notes: string;
};
export type VisitFieldsProps = {
  draft: VisitDraft;
  errors: Record<string, string>;
  change: <Key extends keyof VisitDraft>(key: Key, value: VisitDraft[Key]) => void;
};
export function initialVisitDraft(candidate: Candidate, previousId?: string): VisitDraft {
  const previous = candidate.visits.find((visit) => visit.id === previousId);
  if (previous) return previousVisitDraft(previous);
  return {
    kind: candidate.scheduleType === "PERSONALIZED" ? "INTRODUCTION" : "TRIAL",
    date: dateLabel(candidate.today),
    classId: "",
    meetingKey: "",
    teacher: null,
    startTime: "",
    endTime: "",
    notes: "",
  };
}
function previousVisitDraft(previous: Candidate["visits"][number]): VisitDraft {
  return {
    kind: previous.kind,
    date: dateLabel(previous.date),
    classId: previous.classId ?? "",
    meetingKey: previous.scheduleSlotId ?? previous.classSessionId ?? "",
    teacher: previous.teacherId
      ? { id: previous.teacherId, label: previous.teacherName ?? "Professor" }
      : null,
    startTime: previous.startTime ?? "",
    endTime: previous.endTime ?? "",
    notes: previous.notes ?? "",
  };
}
export function selectedVisitMeeting(
  meetings: MeetingReference[],
  key: string,
): MeetingReference | undefined {
  if (meetings.length === 1) return meetings[0];
  return meetings.find((row) => (row.slotId ?? row.sessionId) === key);
}
export function visitMeetingInput(
  draft: VisitDraft,
  format: Candidate["format"],
  meetings: MeetingReference[],
): RouterInputs["admissions"]["schedule"]["meeting"] {
  if (draft.kind === "INTRODUCTION")
    return {
      kind: draft.kind,
      teacherId: draft.teacher?.id ?? "",
      startTime: draft.startTime,
      endTime: draft.endTime,
      format: format ?? "IN_PERSON",
    };
  const selected = selectedVisitMeeting(meetings, draft.meetingKey);
  return {
    kind: draft.kind,
    classId: draft.classId,
    scheduleSlotId: selected?.slotId ?? null,
    classSessionId: selected?.sessionId ?? null,
  };
}
export function visitSubmitLabel(pending: boolean, rescheduling: boolean): string {
  if (pending) return "Agendando…";
  return rescheduling ? "Confirmar remarcação" : "Agendar aula";
}
