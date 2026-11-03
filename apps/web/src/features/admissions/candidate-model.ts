import type { RouterInputs } from "@lazuli/api";
import { admissionValuesSchema } from "@lazuli/validators";
import { type Candidate } from "./labels";
type Values = RouterInputs["admissions"]["save"]["values"];
export type CandidateDraft = Values;
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
};
export function initialCandidateDraft(candidate?: Candidate): CandidateDraft {
  if (!candidate) return { ...emptyDraft };
  return {
    ...candidateIdentity(candidate),
    stageId: candidate.stageId,
    studentId: candidate.studentId,
    scheduleType: candidate.scheduleType ?? "REGULAR",
    format: candidate.format ?? "IN_PERSON",
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
export function parseCandidateDraft(
  draft: CandidateDraft,
): ReturnType<typeof admissionValuesSchema.safeParse> {
  return admissionValuesSchema.safeParse({
    ...draft,
  });
}
export function candidateSubmitLabel(
  pending: boolean,
  options: {
    step: number;
    editing: boolean;
  },
): string {
  const { step, editing } = options;

  if (pending) return "Salvando…";
  if (step === 0) return "Continuar";
  return editing ? "Salvar alterações" : "Cadastrar lead";
}
