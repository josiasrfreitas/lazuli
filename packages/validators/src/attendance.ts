import { z } from "zod";

const INVALID_SESSION_ID_MESSAGE = "Identificador de sessao invalido.";
const INVALID_ENROLLMENT_ID_MESSAGE = "Identificador de matricula invalido.";
const INVALID_SEMESTER_ID_MESSAGE = "Identificador de semestre invalido.";

/** The MVP attendance status set — no `LATE`/`JUSTIFIED` (D-0009). */
export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT"]);

/** Input for `attendance.sessionRoster` (S-ATT-1/2). */
export const attendanceSessionRosterInputSchema = z
  .object({
    sessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
  })
  .strict();

/** Input for `attendance.enrollmentSemesterPercent` (S-REP-4, D-0029). */
export const attendanceEnrollmentSemesterPercentInputSchema = z
  .object({
    enrollmentId: z.string().uuid(INVALID_ENROLLMENT_ID_MESSAGE),
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE),
  })
  .strict();

const attendanceRowSchema = z
  .object({
    enrollmentId: z.string().uuid(INVALID_ENROLLMENT_ID_MESSAGE),
    status: attendanceStatusSchema,
  })
  .strict();

/**
 * Input for `attendance.confirmSession` (S-ATT-1, D-0029). `rows` carries explicit per-enrollment
 * statuses; any active-roster member omitted from `rows` commits `PRESENT`, and any `rows` entry not on
 * the session roster is rejected in the service layer (the roster/window scope lives on server state, not
 * in this schema).
 */
export const attendanceConfirmSessionInputSchema = z
  .object({
    sessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
    rows: z.array(attendanceRowSchema),
  })
  .strict();

/**
 * Input for `attendance.editSession`. Unlike first confirm, rows are explicit changes only, so callers
 * must send at least one row.
 */
export const attendanceEditSessionInputSchema = z
  .object({
    sessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
    rows: z.array(attendanceRowSchema).min(1, "Informe ao menos uma alteracao."),
  })
  .strict();
