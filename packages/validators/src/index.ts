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
export {
  classArchiveInputSchema,
  classCloneForNextPeriodInputSchema,
  classCreateInputSchema,
  classGenerateSessionsInputSchema,
  classFormatSchema,
  classIdInputSchema,
  classScheduleSlotInputSchema,
  classScheduleTypeSchema,
  timeOfDaySchema,
  weekdaySchema,
} from "./class.js";
export {
  addClosedDayInputSchema,
  calendarDateSchema,
  calendarYearSchema,
  closedDayReasonSchema,
  createSemesterInputSchema,
  importBrazilFederalHolidaysInputSchema,
  removeClosedDayInputSchema,
} from "./calendar.js";
export {
  enrollmentAdvanceStageInputSchema,
  enrollmentCloseInputSchema,
  enrollmentCreateInputSchema,
  enrollmentTransferInputSchema,
} from "./enrollment.js";
export {
  attendanceConfirmSessionInputSchema,
  attendanceSessionRosterInputSchema,
  attendanceStatusSchema,
} from "./attendance.js";
export {
  makeupCancelInputSchema,
  makeupOutcomeInputSchema,
  makeupScheduleInputSchema,
} from "./makeup.js";
