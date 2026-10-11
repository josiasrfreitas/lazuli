import {
  attendanceTokenSchema,
  attendanceNameSearchSchema,
  attendanceDeclarationSchema,
  attendanceWindowTargetSchema,
  attendanceWindowOpenSchema,
} from "@lazuli/validators";
import { router, publicProcedure, staffProcedure } from "../trpc/init.js";
import { attendanceStatus, openAttendanceWindow, closeAttendanceWindow } from "./staff.js";
import {
  inspectAttendanceLink,
  findAttendanceName,
  submitAttendanceDeclaration,
} from "./public.js";
export const studentAttendanceRouter = router({
  status: staffProcedure
    .input(attendanceWindowTargetSchema)
    .query(({ ctx, input }) =>
      attendanceStatus(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.sessionId,
      ),
    ),
  open: staffProcedure
    .input(attendanceWindowOpenSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        openAttendanceWindow(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          input,
        ),
      ),
    ),
  close: staffProcedure
    .input(attendanceWindowTargetSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        closeAttendanceWindow(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          input.sessionId,
        ),
      ),
    ),
  // Public reads use POST so the capability never enters request URLs or referrer/query logs.
  inspect: publicProcedure
    .input(attendanceTokenSchema)
    .mutation(({ ctx, input }) =>
      inspectAttendanceLink({ database: ctx.db, now: ctx.now ?? new Date() }, input.token),
    ),
  search: publicProcedure
    .input(attendanceNameSearchSchema)
    .mutation(({ ctx, input }) =>
      findAttendanceName({ database: ctx.db, now: ctx.now ?? new Date() }, input),
    ),
  submit: publicProcedure
    .input(attendanceDeclarationSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        submitAttendanceDeclaration({ database, now: ctx.now ?? new Date() }, input),
      ),
    ),
});
