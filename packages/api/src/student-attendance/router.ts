import {
  z,
  attendanceTokenSchema,
  attendanceNameSearchSchema,
  attendanceDeclarationSchema,
  attendanceWindowTargetSchema,
  attendanceWindowOpenSchema,
} from "@lazuli/validators";
import { router, publicProcedure, staffProcedure, adminProcedure } from "../trpc/init.js";
import { readAttendanceProjection, attendanceReceipt } from "./projection.js";
import { attendanceStatus, openAttendanceWindow, closeAttendanceWindow } from "./staff.js";
import {
  inspectAttendanceLink,
  findAttendanceName,
  submitAttendanceDeclaration,
} from "./public.js";
export const studentAttendanceRouter = router({
  settings: adminProcedure.query(({ ctx }) => ctx.db.attendanceSettings.findUnique({ where: { id: "school" } })),
  saveSettings: adminProcedure.input(z.object({
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(10).max(1000), maxAccuracyMeters: z.number().int().min(5).max(500),
  }).strict()).mutation(({ ctx, input }) => ctx.db.attendanceSettings.upsert({ where: { id: "school" }, create: { id: "school", ...input, updatedById: ctx.staffUser.id }, update: { ...input, updatedById: ctx.staffUser.id } })),
  projection: publicProcedure.input(attendanceTokenSchema).mutation(({ ctx, input }) => readAttendanceProjection(ctx.db, input.token, ctx.now ?? new Date())),
  receipt: publicProcedure.input(attendanceTokenSchema.extend({ browserId: z.string().uuid() })).mutation(({ ctx, input }) => attendanceReceipt(ctx.db, input.token, input.browserId)),
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
