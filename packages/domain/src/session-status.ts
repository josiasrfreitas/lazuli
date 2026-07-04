import { sessionEndInstant } from "./session-time.js";

type DateInput = Date | string;

/**
 * A scheduled session is "untaken" once its end instant has passed in
 * America/Sao_Paulo with no confirmed attendance (§3.2, D-0029). Cancelled and
 * already-confirmed sessions are never untaken.
 */
export function isSessionUntaken(input: {
  status: "SCHEDULED" | "CANCELLED";
  date: DateInput;
  endTime: DateInput;
  attendanceConfirmedAt: Date | null;
  now: Date;
}): boolean {
  if (input.status === "CANCELLED") {
    return false;
  }
  if (input.attendanceConfirmedAt !== null) {
    return false;
  }

  const endInstant = sessionEndInstant({ date: input.date, endTime: input.endTime });

  return input.now.getTime() >= endInstant.getTime();
}
