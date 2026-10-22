import type { RouterInputs } from "@lazuli/api";
import type { SearchSelectOption } from "@lazuli/ui";
import { parseDateBR } from "~/lib/masks";
import { isMinorOn } from "~/features/students/new-student/reducer";
import type { Candidate } from "./labels";
export type EnrollmentDraft = {
  mode: "existing" | "create";
  name: string;
  birthDate: string;
  guardianName: string;
  guardianPhone: string;
  search: string;
  student: SearchSelectOption | null;
};
export type EnrollmentFieldsProps = {
  draft: EnrollmentDraft;
  errors: Record<string, string>;
  today: string;
  change: <Key extends keyof EnrollmentDraft>(key: Key, value: EnrollmentDraft[Key]) => void;
};
export function initialEnrollmentDraft(candidate: Candidate): EnrollmentDraft {
  return {
    mode: candidate.student ? "existing" : "create",
    name: candidate.fullName,
    birthDate: "",
    guardianName: "",
    guardianPhone: "",
    search: candidate.fullName,
    student: candidate.student
      ? { id: candidate.student.id, label: candidate.student.fullName }
      : null,
  };
}
export function enrollmentMinor(draft: EnrollmentDraft, today: string): boolean {
  const birthDate = parseDateBR(draft.birthDate);
  return birthDate !== null && birthDate <= today && isMinorOn({ birthDate, today });
}
export function enrollmentErrors(draft: EnrollmentDraft, today: string): Record<string, string> {
  if (draft.mode === "existing")
    return draft.student ? {} : { student: "Escolha o cadastro do aluno." };
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Informe o nome.";
  const birth = parseDateBR(draft.birthDate);
  if (draft.birthDate && !birth) errors.birthDate = "Data inválida.";
  if (birth && birth > today) errors.birthDate = "A data não pode ser futura.";
  return { ...errors, ...guardianErrors(draft, today) };
}
function guardianErrors(draft: EnrollmentDraft, today: string): Record<string, string> {
  if (!enrollmentMinor(draft, today)) return {};
  const errors: Record<string, string> = {};
  if (!draft.guardianName.trim()) errors.guardianName = "Informe o responsável.";
  if (!draft.guardianPhone.trim()) errors.guardianPhone = "Informe o contato do responsável.";
  return errors;
}
export function enrollmentStudent(
  draft: EnrollmentDraft,
  candidate: Pick<Candidate, "today" | "phone" | "email">,
): RouterInputs["admissions"]["enroll"]["student"] | null {
  if (draft.mode === "existing")
    return draft.student ? { mode: "existing", id: draft.student.id } : null;
  const birth = parseDateBR(draft.birthDate);
  return {
    mode: "create",
    values: {
      fullName: draft.name.trim(),
      phone: candidate.phone,
      email: candidate.email,
      birthDate: birth ? new Date(birth) : null,
      ...(enrollmentMinor(draft, candidate.today)
        ? {
            guardian: {
              mode: "create",
              input: { fullName: draft.guardianName.trim(), phone: draft.guardianPhone },
            },
          }
        : {}),
    },
  };
}
