import {
  studentCreateInputSchema,
  type studentUpdateContactInputSchema,
  type z,
} from "@lazuli/validators";

import { parseDateBR } from "~/lib/masks";

import type { ContractFields } from "../../contracts/contract-form-model";
import { contractInputFromFields, previewContractInput } from "../../contracts/contract-form-model";
import type { NewStudentFields } from "./reducer";

export type StudentCreateInput = z.input<typeof studentCreateInputSchema>;

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function addressInput(address: NewStudentFields["address"]): StudentCreateInput["address"] {
  if (!address) return undefined;
  if (!Object.values(address).some((value) => value.trim())) return null;
  return {
    street: orUndefined(address.street) ?? null,
    number: orUndefined(address.number) ?? null,
    complement: orUndefined(address.complement) ?? null,
    neighborhood: orUndefined(address.neighborhood) ?? null,
    city: orUndefined(address.city) ?? null,
    state: orUndefined(address.state) ?? null,
    postalCode: orUndefined(address.postalCode) ?? null,
  };
}

/** Converts typed wizard values to the student command, preserving the birth calendar date. */
export function toCreateInput(fields: NewStudentFields): StudentCreateInput {
  const guardianName = orUndefined(fields.guardianName);
  const birthDate = parseDateBR(fields.birthDate);
  const address = addressInput(fields.address);
  return {
    ...(address === undefined ? {} : { address }),
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
              documentType: fields.guardianDocumentType
                ? (fields.guardianDocumentType as "CPF" | "RG")
                : undefined,
              documentNumber: orUndefined(fields.guardianDocumentNumber),
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
    studentBirthDate: student.birthDate,
    studentDocumentType: student.documentType,
    studentDocumentNumber: student.documentNumber,
    studentPhone: student.phone,
    studentEmail: student.email,
    studentGuardianMode: student.guardianName.trim() ? "create" : "",
    studentGuardianName: student.guardianName,
    studentGuardianDocumentType: student.guardianDocumentType,
    studentGuardianDocumentNumber: student.guardianDocumentNumber,
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

export function toContactUpdate(
  fields: NewStudentFields,
  hasGuardian: boolean,
): z.input<typeof studentUpdateContactInputSchema> {
  const birthDate = parseDateBR(fields.birthDate);
  return {
    address: addressInput(fields.address),
    fullName: fields.fullName.trim(),
    phone: fields.phone.trim() || null,
    email: fields.email.trim() || null,
    documentType: fields.documentType ? (fields.documentType as "CPF" | "RG") : null,
    documentNumber: fields.documentNumber.trim() || null,
    birthDate: birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : null,
    guardian: contactGuardianUpdate(fields, hasGuardian),
  };
}

function contactGuardianUpdate(
  fields: NewStudentFields,
  hasGuardian: boolean,
): z.input<typeof studentUpdateContactInputSchema>["guardian"] {
  if (!fields.guardianName.trim()) return hasGuardian ? { mode: "disconnect" } : undefined;
  return {
    mode: hasGuardian ? "update" : "create",
    input: {
      fullName: fields.guardianName.trim(),
      documentType: fields.guardianDocumentType
        ? (fields.guardianDocumentType as "CPF" | "RG")
        : null,
      documentNumber: fields.guardianDocumentNumber.trim() || null,
      phone: fields.guardianPhone.trim() || null,
      email: fields.guardianEmail.trim() || null,
    },
  };
}
