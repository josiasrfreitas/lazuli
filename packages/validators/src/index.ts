/** Zod schemas shared by API, workers, and scripts (§2.1). */
export { z } from "zod";
export {
  addressInputSchema,
  createGuardianReferenceSchema,
  dateOnlyInputSchema,
  DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
  documentTypeSchema,
  guardianCreateInputSchema,
  guardianUpdateInputSchema,
  MINOR_GUARDIAN_REQUIRES_CONTACT_MESSAGE,
  MINOR_REQUIRES_GUARDIAN_MESSAGE,
  studentCreateInputSchema,
  studentIdInputSchema,
  studentSearchInputSchema,
  studentSetStatusInputSchema,
  studentStatusSchema,
  studentUpdateContactInputSchema,
  studentUpdateContactProcedureInputSchema,
  studentUpdateNotesInputSchema,
  updateGuardianReferenceSchema,
} from "./student.js";
