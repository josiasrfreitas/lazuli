import { studentCreateInputSchema, type z } from "@lazuli/validators";

import { parseDateBR } from "~/lib/masks";

import type { ContractFields } from "../../contracts/contract-form-model";
import { contractInputFromFields, previewContractInput } from "../../contracts/contract-form-model";
import type { NewStudentFields } from "./reducer";

export type StudentCreateInput = z.input<typeof studentCreateInputSchema>;

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Converts typed wizard values to the student command, preserving the birth calendar date. */
export function toCreateInput(fields: NewStudentFields): StudentCreateInput {
  const guardianName = orUndefined(fields.guardianName);
  const birthDate = parseDateBR(fields.birthDate);
  return {
    fullName: fields.fullName.trim(),
    phone: orUndefined(fields.phone),
    email: orUndefined(fields.email),
    birthDate: birthDate === null ? undefined : new Date(`${birthDate}T00:00:00.000Z`),
    documentType: fields.documentType === "" ? undefined : (fields.documentType as "CPF" | "RG"),
    documentNumber: orUndefined(fields.documentNumber),
    guardian:
      guardianName === undefined
        ? undefined
        : {
            mode: "create",
            input: {
              fullName: guardianName,
              phone: orUndefined(fields.guardianPhone),
              email: orUndefined(fields.guardianEmail),
            },
          },
  };
}

export function studentContractInput(input: {
  fields: ContractFields;
  student: NewStudentFields;
  commandId: string;
}): ReturnType<typeof contractInputFromFields> {
  return contractInputFromFields(input.fields, {
    commandId: input.commandId,
    newStudent: toCreateInput(input.student),
  });
}

export function studentContractPreview(input: {
  fields: ContractFields;
  student: NewStudentFields;
  offer: Parameters<typeof previewContractInput>[1];
}): ReturnType<typeof previewContractInput> {
  const parsed = studentContractInput({
    ...input,
    commandId: "00000000-0000-4000-8000-000000000001",
  });
  return previewContractInput(parsed, input.offer);
}

/** Adapts an unpersisted student draft to the existing contract payer controls. */
export function contractFieldsWithStudent(
  fields: ContractFields,
  student: NewStudentFields,
): ContractFields {
  return {
    ...fields,
    studentMode: "create",
    studentId: "",
    studentDraftName: student.fullName,
    studentDocumentType: student.documentType,
    studentDocumentNumber: student.documentNumber,
    studentPhone: student.phone,
    studentEmail: student.email,
    studentGuardianMode: student.guardianName.trim() ? "create" : "",
    studentGuardianName: student.guardianName,
    studentGuardianPhone: student.guardianPhone,
    studentGuardianEmail: student.guardianEmail,
  };
}

const BUSINESS_ERRORS = new Set(["BAD_REQUEST", "NOT_FOUND", "CONFLICT", "PRECONDITION_FAILED"]);

export function completionErrorMessage(error: {
  message: string;
  data?: { code: string } | null | undefined;
}): string {
  if (error.data && BUSINESS_ERRORS.has(error.data.code)) return error.message;
  return "Não foi possível concluir o cadastro. Seus dados foram mantidos; tente novamente.";
}
