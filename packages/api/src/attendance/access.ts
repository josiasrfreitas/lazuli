import { TRPCError } from "@trpc/server";

import { isSameDayInSaoPaulo } from "@lazuli/domain";

import type { StaffUser } from "../trpc/context.js";

/** ADMIN may manage any attendance date; TEACHER is limited to the session's SP calendar day. */
export function assertAttendanceWriteWindow(input: {
  staffUser: StaffUser;
  sessionDate: Date;
  now: Date;
}): void {
  if (input.staffUser.role === "ADMIN") {
    return;
  }
  if (
    input.staffUser.role === "TEACHER" &&
    isSameDayInSaoPaulo({ targetDate: input.sessionDate, now: input.now })
  ) {
    return;
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}
