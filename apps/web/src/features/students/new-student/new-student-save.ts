import type { RouterInputs } from "@lazuli/api";
import type { RegistrationDocumentKind } from "@lazuli/domain";
import { studentIntakeEnrollSchema, studentIntakeResumeSchema } from "@lazuli/validators";
import {
  contractInputFromFields,
  type ContractFields,
} from "~/features/contracts/contract-form-model";
import type { LeadRegistration } from "~/features/admissions/lead-capture-dialog";
import { studentContractInput, toContactUpdate, toCreateInput } from "./finance-model";
import type { NewStudentFields } from "./reducer";

export function intakeSaveIssue({
  blockedLead,
  entryPeriod,
  selectedId,
  optionsFetching,
  selected,
  stageId,
  waitingPlacement,
}: {
  blockedLead: boolean;
  entryPeriod: "CURRENT" | "NEXT";
  selectedId: string;
  optionsFetching: boolean;
  selected: boolean;
  stageId: string | null;
  waitingPlacement: boolean;
}): string | undefined {
  if (blockedLead) return "Confira o vínculo do lead antes de salvar o aluno.";
  if (selectedId && (optionsFetching || !selected))
    return "Confira a turma na etapa pedagógica antes de salvar.";
  if (entryPeriod === "CURRENT" && selected && (!stageId || waitingPlacement))
    return "Conclua o nivelamento antes de confirmar a turma.";
  return undefined;
}

export function intakeContract({
  withContract,
  existingContract,
  existingStudentId,
  fields,
  student,
  commandId,
}: {
  withContract: boolean;
  existingContract: boolean;
  existingStudentId: string | undefined;
  fields: ContractFields;
  student: NewStudentFields;
  commandId: string;
}): ReturnType<typeof contractInputFromFields> | null {
  if (!withContract || existingContract) return null;
  if (existingStudentId)
    return contractInputFromFields(
      { ...fields, studentMode: "existing", studentId: existingStudentId },
      commandId,
    );
  return studentContractInput({ fields, student, commandId });
}

export type IntakePendingItem = {
  kind: "class" | "contract" | "documents";
  label: string;
};

const DOCUMENT_LABELS: Record<RegistrationDocumentKind, string> = {
  student: "identidade do aluno",
  guardian: "identidade do responsável",
  residence: "comprovante de residência",
  photo: "foto do aluno",
};

export function intakePendingItems({
  selected,
  entryPeriod,
  existingEnrollment,
  waitingPlacement,
  withContract,
  existingContract,
  missingDocuments,
}: {
  selected: boolean;
  entryPeriod: "CURRENT" | "NEXT";
  existingEnrollment: boolean;
  waitingPlacement: boolean;
  withContract: boolean;
  existingContract: boolean;
  missingDocuments: RegistrationDocumentKind[] | null;
}): IntakePendingItem[] {
  const items: IntakePendingItem[] = [];
  if (!selected && !existingEnrollment)
    items.push({
      kind: "class",
      label:
        entryPeriod === "NEXT"
          ? "Definir a turma do próximo período na página do aluno."
          : waitingPlacement
            ? "Concluir o nivelamento e escolher a turma."
            : "Definir a turma na página do aluno.",
    });
  if (!withContract && !existingContract)
    items.push({
      kind: "contract",
      label: "Concluir o contrato. Os dados do contrato em rascunho não serão salvos.",
    });
  if (missingDocuments === null || missingDocuments.length > 0)
    items.push({
      kind: "documents",
      label: missingDocuments
        ? `Anexar ${missingDocuments.map((kind) => DOCUMENT_LABELS[kind]).join(", ")}.`
        : "Conferir os anexos cadastrais.",
    });
  return items;
}

type IntakeCommand =
  | RouterInputs["students"]["enrollNew"]
  | RouterInputs["students"]["resumeIntake"];
type IntakeShared = {
  entryPeriod: "CURRENT" | "NEXT";
  stageId: string | null;
  classId: string | null;
  planId: string | null;
  contract: RouterInputs["students"]["enrollNew"]["contract"];
  allowPending: boolean;
};
type IntakeParse = { input: IntakeCommand; error?: never } | { input?: never; error: string };

export function parseIntakeCommand({
  existingStudentId,
  fields,
  hasGuardian,
  commandId,
  candidateId,
  draftLead,
  shared,
}: {
  existingStudentId: string | undefined;
  fields: NewStudentFields;
  hasGuardian: boolean;
  commandId: string;
  candidateId: string | null;
  draftLead: LeadRegistration | null;
  shared: IntakeShared;
}): IntakeParse {
  if (existingStudentId) {
    const parsed = studentIntakeResumeSchema.safeParse({
      studentId: existingStudentId,
      contact: toContactUpdate(fields, hasGuardian),
      ...shared,
    });
    return parsed.success
      ? { input: parsed.data }
      : { error: parsed.error.issues[0]?.message ?? "Confira os dados do aluno." };
  }
  const parsed = studentIntakeEnrollSchema.safeParse({
    commandId,
    candidateId,
    leadRegistration: draftLead,
    student: toCreateInput(fields),
    ...shared,
  });
  return parsed.success
    ? { input: parsed.data }
    : { error: parsed.error.issues[0]?.message ?? "Confira os dados do aluno." };
}
