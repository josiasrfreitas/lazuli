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

/** Explicit copy only: a guardian is never assumed to be the payer. */
export function payerFieldsFromStudent(
  student: NewStudentFields,
  source: "student" | "guardian",
): Partial<ContractFields> {
  const guardian = source === "guardian";
  return {
    payerMode: "create",
    payerName: guardian ? student.guardianName : student.fullName,
    payerDocumentType: guardian ? "" : student.documentType,
    payerDocumentNumber: guardian ? "" : student.documentNumber,
    payerPhone: guardian ? student.guardianPhone : student.phone,
    payerEmail: guardian ? student.guardianEmail : student.email,
  };
}
