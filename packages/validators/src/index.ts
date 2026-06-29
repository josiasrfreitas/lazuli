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
  MINOR_REQUIRES_GUARDIAN_MESSAGE,
  studentCreateInputSchema,
  studentIdInputSchema,
  studentStatusSchema,
  studentUpdateContactInputSchema,
  studentUpdateContactProcedureInputSchema,
  studentUpdateNotesInputSchema,
  updateGuardianReferenceSchema,
} from "./student.js";
