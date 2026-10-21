import type { RouterInputs } from "@lazuli/api";
import { admissionValuesSchema } from "@lazuli/validators";
import { parseDateBR } from "~/lib/masks";
import { dateLabel, timeLabel, type Candidate } from "./labels";
type Values = RouterInputs["admissions"]["save"]["values"];
export type CandidateDraft = Omit<Values, "availableUntil"> & { availableUntil: string };
export type CandidateFieldsProps = {
  draft: CandidateDraft;
  errors: Record<string, string>;
  change: <Key extends keyof CandidateDraft>(key: Key, value: CandidateDraft[Key]) => void;
};
const emptyDraft: CandidateDraft = {
  fullName: "",
  contactName: "",
  source: "",
  phone: "",
  email: "",
  notes: "",
  stageId: null,
  studentId: null,
  scheduleType: "REGULAR",
  format: "IN_PERSON",
  availableUntil: "",
  availability: [{ weekday: "MONDAY", startTime: "", endTime: "" }],
};
export function initialCandidateDraft(candidate?: Candidate): CandidateDraft {
  if (!candidate)
    return { ...emptyDraft, availability: emptyDraft.availability.map((slot) => ({ ...slot })) };
  return {
    ...candidateIdentity(candidate),
    stageId: candidate.stageId,
    studentId: candidate.studentId,
    scheduleType: candidate.scheduleType ?? "REGULAR",
    format: candidate.format ?? "IN_PERSON",
    availableUntil: candidate.availableUntil ? dateLabel(candidate.availableUntil) : "",
    availability:
      candidate.availability.length > 0
        ? candidate.availability.map((slot) => ({
            weekday: slot.weekday,
            startTime: timeLabel(slot.startTime),
            endTime: timeLabel(slot.endTime),
          }))
        : emptyDraft.availability.map((slot) => ({ ...slot })),
  };
}
function candidateIdentity(candidate: Candidate): {
  fullName: string;
  contactName: string;
  source: string;
  phone: string;
  email: string;
  notes: string;
} {
  return {
    fullName: candidate.fullName,
    contactName: candidate.contactName ?? "",
    source: candidate.source ?? "",
    phone: candidate.phone ?? "",
    email: candidate.email ?? "",
    notes: candidate.notes ?? "",
  };
}
export function parseCandidateDraft(draft: CandidateDraft) {
  return admissionValuesSchema.safeParse({
    ...draft,
    availableUntil: parseDateBR(draft.availableUntil) ?? "",
  });
}
export function candidateSubmitLabel(pending: boolean, step: number, editing: boolean): string {
  if (pending) return "Salvando…";
  if (step === 0) return "Continuar";
  return editing ? "Salvar alterações" : "Cadastrar lead";
}
