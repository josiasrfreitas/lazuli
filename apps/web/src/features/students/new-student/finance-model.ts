import type { ContractFields } from "../../contracts/contract-form-model";
import { contractInputFromFields, previewContractInput } from "../../contracts/contract-form-model";
import type { NewStudentFields } from "./reducer";
import { toCreateInput } from "./to-create-input";

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

/** Feed the existing contract payer picker/copy control from the unpersisted student draft. */
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
