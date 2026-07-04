import { sessionEndInstant } from "./session-time.js";

type DateInput = Date | string;

/** Derived makeup outcome (§3.2, §4.6). */
export type MakeupDisplayStatus = "CANCELLED" | "ATTENDED" | "NO_SHOW" | "SCHEDULED";

/**
 * Derives a makeup's display status with precedence
 * CANCELLED → ATTENDED → NO_SHOW → SCHEDULED (§4.6). A makeup is CANCELLED when
 * its own `cancelledAt` is set or its target session is cancelled; NO_SHOW once
 * the target session's end instant has passed with no attendance.
 */
export function deriveMakeupDisplayStatus(input: {
  cancelledAt: Date | null;
  targetSessionCancelled: boolean;
  attendedAt: Date | null;
  targetSessionDate: DateInput;
  targetSessionEndTime: DateInput;
  now: Date;
}): MakeupDisplayStatus {
  if (input.cancelledAt !== null || input.targetSessionCancelled) {
    return "CANCELLED";
  }
  if (input.attendedAt !== null) {
    return "ATTENDED";
  }

  const endInstant = sessionEndInstant({
    date: input.targetSessionDate,
    endTime: input.targetSessionEndTime,
  });
  if (input.now.getTime() >= endInstant.getTime()) {
    return "NO_SHOW";
  }

  return "SCHEDULED";
}
