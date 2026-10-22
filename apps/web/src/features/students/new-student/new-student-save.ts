import type { RouterInputs } from "@lazuli/api";
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
  selectedId,
  optionsFetching,
  selected,
  stageId,
  waitingPlacement,
}: {
  blockedLead: boolean;
  selectedId: string;
  optionsFetching: boolean;
  selected: boolean;
  stageId: string | null;
  waitingPlacement: boolean;
}): string | undefined {
  if (blockedLead) return "Confira o vínculo do lead antes de salvar o aluno.";
  if (selectedId && (optionsFetching || !selected))
    return "Confira a turma na etapa pedagógica antes de salvar.";
  if (selected && (!stageId || waitingPlacement))
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

export function intakePendingItems({
  selected,
  existingEnrollment,
  waitingPlacement,
  withContract,
  existingContract,
}: {
  selected: boolean;
  existingEnrollment: boolean;
  waitingPlacement: boolean;
  withContract: boolean;
  existingContract: boolean;
}): string[] {
  const items: string[] = [];
  if (!selected && !existingEnrollment)
    items.push(
      waitingPlacement
        ? "Concluir o nivelamento e escolher a turma."
        : "Definir a turma na etapa pedagógica.",
    );
  if (!withContract && !existingContract)
    items.push("Concluir o contrato. Os dados do contrato em rascunho não serão salvos.");
  return items;
}

type IntakeCommand =
  | RouterInputs["students"]["enrollNew"]
  | RouterInputs["students"]["resumeIntake"];
type IntakeShared = {
  stageId: string | null;
  classId: string | null;
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
