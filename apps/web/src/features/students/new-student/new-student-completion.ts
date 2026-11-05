import { missingRegistrationDocuments, type RegistrationDocumentKind } from "@lazuli/domain";
import type { EnrollmentDocuments } from "~/features/student-documents/use-enrollment-documents";
import { isMinorFromFields, validateDados, type NewStudentFields } from "./reducer";

type CompletionInput = {
  documents: EnrollmentDocuments;
  fields: NewStudentFields;
  today: string;
  existingStudentId: string | undefined;
};

export function missingIntakeDocuments(input: CompletionInput): RegistrationDocumentKind[] | null {
  const { documents, fields, today, existingStudentId } = input;
  const files = documents.query.data?.files;
  if (!files && (existingStudentId || documents.session)) return null;
  return missingRegistrationDocuments(
    isMinorFromFields(fields, today),
    (files ?? []).map((file) => file.kind),
  );
}

export function intakeStepCompletion(input: CompletionInput): {
  student: boolean;
  address: boolean;
} {
  const { fields, today } = input;
  const missing = missingIntakeDocuments(input);
  const address = fields.address;
  return {
    student: Object.keys(validateDados(fields, today)).length === 0 && missing?.length === 0,
    address: Boolean(
      address &&
      [address.street, address.neighborhood, address.city, address.state, address.postalCode].every(
        (value) => value.trim().length > 0,
      ),
    ),
  };
}
