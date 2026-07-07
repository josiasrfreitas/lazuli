import { z } from "zod";

const INVALID_SESSION_ID_MESSAGE = "Identificador de sessao invalido.";
const INVALID_ENROLLMENT_ID_MESSAGE = "Identificador de matricula invalido.";

/** The MVP attendance status set — no `LATE`/`JUSTIFIED` (D-0009). */
export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT"]);

/** Input for `attendance.sessionRoster` (S-ATT-1/2). */
export const attendanceSessionRosterInputSchema = z
  .object({
    sessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
  })
  .strict();

const attendanceConfirmRowSchema = z
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
    rows: z.array(attendanceConfirmRowSchema),
  })
  .strict();
