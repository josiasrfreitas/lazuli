import {
  attendanceConfirmSessionInputSchema,
  attendanceEditSessionInputSchema,
  attendanceSessionRosterInputSchema,
  makeupCancelInputSchema,
  makeupOutcomeInputSchema,
  makeupScheduleInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router, staffProcedure } from "../trpc/init.js";
import { confirmSession } from "./confirm.js";
import { editSession } from "./edit.js";
import { cancelMakeup } from "./makeup-cancel.js";
import { markMakeupOutcome } from "./makeup-outcome.js";
import { scheduleMakeup } from "./makeup-schedule.js";
import { readSessionRoster } from "./roster.js";

export const attendanceRouter = router({
  sessionRoster: staffProcedure
    .input(attendanceSessionRosterInputSchema)
    .query(({ ctx, input }) =>
      readSessionRoster({ database: ctx.db, staffUser: ctx.staffUser, sessionId: input.sessionId }),
    ),
  confirmSession: staffProcedure
    .input(attendanceConfirmSessionInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        confirmSession({
          database,
          staffUser: ctx.staffUser,
          values: input,
          now: ctx.now ?? new Date(),
        }),
      ),
    ),
  editSession: staffProcedure.input(attendanceEditSessionInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      editSession({
        database,
        staffUser: ctx.staffUser,
        values: input,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  // Coordination (logged in as ADMIN) schedules/cancels makeups (S-ATT-3, D-0010).
  scheduleMakeup: adminProcedure
    .input(makeupScheduleInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        scheduleMakeup({ database, staffUser: ctx.staffUser, values: input }),
      ),
    ),
  cancelMakeup: adminProcedure
    .input(makeupCancelInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        cancelMakeup({ database, staffUser: ctx.staffUser, values: input }),
      ),
    ),
  // The owning teacher (or ADMIN) records whether the visitor showed up (S-ATT-2).
  markMakeupOutcome: staffProcedure
    .input(makeupOutcomeInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        markMakeupOutcome({ database, staffUser: ctx.staffUser, values: input }),
      ),
    ),
});
