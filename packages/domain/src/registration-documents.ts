export const REGISTRATION_DOCUMENT_KINDS = ["student", "residence", "photo"] as const;

export type RegistrationDocumentKind = (typeof REGISTRATION_DOCUMENT_KINDS)[number] | "guardian";

export function requiredRegistrationDocuments(minor: boolean): RegistrationDocumentKind[] {
  return minor
    ? [REGISTRATION_DOCUMENT_KINDS[0], "guardian", ...REGISTRATION_DOCUMENT_KINDS.slice(1)]
    : [...REGISTRATION_DOCUMENT_KINDS];
}

export function missingRegistrationDocuments(
  minor: boolean,
  present: Iterable<string>,
): RegistrationDocumentKind[] {
  const uploaded = new Set(present);
  return requiredRegistrationDocuments(minor).filter((kind) => !uploaded.has(kind));
}
