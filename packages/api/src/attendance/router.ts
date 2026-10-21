import { assertAttendanceOnlyWrite } from "../class-records/data.js";
import { closeAttendanceWindows } from "../student-attendance/data.js";
import { sessionSubject } from "../activity/subjects.js";
import { activityTransaction, recordActivity } from "../activity/record.js";
import {
  attendanceConfirmSessionInputSchema,
  attendanceEditSessionInputSchema,
  attendanceEnrollmentSemesterPercentInputSchema,
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
import { readEnrollmentSemesterPercent } from "./percent.js";
import { readSessionRoster } from "./roster.js";

export const attendanceRouter = router({
  sessionRoster: staffProcedure
    .input(attendanceSessionRosterInputSchema)
    .query(({ ctx, input }) =>
      readSessionRoster({ database: ctx.db, staffUser: ctx.staffUser, sessionId: input.sessionId }),
    ),
  enrollmentSemesterPercent: staffProcedure
    .input(attendanceEnrollmentSemesterPercentInputSchema)
    .query(({ ctx, input }) =>
      readEnrollmentSemesterPercent({
        database: ctx.db,
        staffUser: ctx.staffUser,
        values: input,
      }),
    ),
  confirmSession: staffProcedure
    .input(attendanceConfirmSessionInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "attendance.confirmSession",
        async (database) => {
          await assertAttendanceOnlyWrite(database, input.sessionId);
          const closedWindows = await closeAttendanceWindows(database, {
            sessionId: input.sessionId,
            userId: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          });
          if (closedWindows > 0)
            await recordActivity(database, ctx, "studentAttendance.close", {
              subject: await sessionSubject(database, input.sessionId),
              description:
                "Recebimento de presença encerrado na confirmação da chamada. Envios recebidos preservados.",
            });
          return confirmSession({
            database,
            staffUser: ctx.staffUser,
            values: input,
            now: ctx.now ?? new Date(),
          });
        },
        async (_result, database) => ({ subject: await sessionSubject(database, input.sessionId) }),
      ),
    ),
  editSession: staffProcedure.input(attendanceEditSessionInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "attendance.editSession",
      async (database) => {
        await assertAttendanceOnlyWrite(database, input.sessionId);
        return editSession({
          database,
          staffUser: ctx.staffUser,
          values: input,
          now: ctx.now ?? new Date(),
        });
      },
      async (_result, database) => ({ subject: await sessionSubject(database, input.sessionId) }),
    ),
  ),
  scheduleMakeup: adminProcedure.input(makeupScheduleInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      scheduleMakeup({
        database,
        staffUser: ctx.staffUser,
        values: input,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  cancelMakeup: adminProcedure.input(makeupCancelInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      cancelMakeup({
        database,
        staffUser: ctx.staffUser,
        values: input,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  markMakeupOutcome: staffProcedure.input(makeupOutcomeInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      markMakeupOutcome({
        database,
        staffUser: ctx.staffUser,
        values: input,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
});
