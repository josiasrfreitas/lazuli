import { missingRegistrationDocuments, type RegistrationDocumentKind } from "@lazuli/domain";
import type { EnrollmentDocuments } from "~/features/student-documents/use-enrollment-documents";
import { isMinorFromFields, validateDados, type NewStudentFields } from "./reducer";

export function missingIntakeDocuments(
  documents: EnrollmentDocuments,
  fields: NewStudentFields,
  today: string,
  existingStudentId: string | undefined,
): RegistrationDocumentKind[] | null {
  const files = documents.query.data?.files;
  if (!files && (existingStudentId || documents.session)) return null;
  return missingRegistrationDocuments(
    isMinorFromFields(fields, today),
    (files ?? []).map((file) => file.kind),
  );
}

export function intakeStepCompletion(
  documents: EnrollmentDocuments,
  fields: NewStudentFields,
  today: string,
  existingStudentId: string | undefined,
): { student: boolean; address: boolean } {
  const missing = missingIntakeDocuments(documents, fields, today, existingStudentId);
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
