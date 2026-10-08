import { TRPCError } from "@trpc/server";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  z,
  civilDateSchema,
  teacherCreateInputSchema,
  teacherUpdateInputSchema,
  teacherListInputSchema,
  teacherIdInputSchema,
  teacherWeekInputSchema,
  teacherDepartureInputSchema,
  classTeacherAssignInputSchema,
  classSubstituteInputSchema,
} from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import type { Context } from "../trpc/context.js";
import { assignClassTeacher, createTeacher, updateTeacher, substituteMeeting } from "./commands.js";
import { departurePreview, scheduleDeparture } from "./departure.js";
import {
  listTeachers,
  readTeacher,
  teacherOptions,
  uncoveredMeetings,
  teacherClasses,
  teacherStudentCount,
} from "./read.js";
import { teacherWeek } from "./schedule.js";
import { lockTeacher } from "./availability.js";

async function command<T>(
  database: Context["db"],
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await database.$transaction(
      async (tx) => {
        await lockTeacher(tx, "");
        return work(tx);
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Este cadastro ou esta atribuição já existe. Atualize os dados e tente novamente.",
      });
    }
    throw error;
  }
}

export const teachersRouter = router({
  classes: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(({ ctx, input }) => teacherClasses(ctx.db, input, ctx.now ?? new Date())),
  list: adminProcedure
    .input(teacherListInputSchema)
    .query(({ ctx, input }) => listTeachers(ctx.db, input, ctx.now ?? new Date())),
  byId: adminProcedure.input(teacherIdInputSchema).query(async ({ ctx, input }) => {
    const now = ctx.now ?? new Date();
    const teacher = await readTeacher(ctx.db, input.id);
    return {
      ...teacher,
      today: saoPauloDateOnly(now),
      studentCount: await teacherStudentCount(ctx.db, input.id, now),
    };
  }),
  options: adminProcedure
    .input(z.object({ date: civilDateSchema, search: z.string().max(80).default("") }))
    .query(({ ctx, input }) => teacherOptions(ctx.db, input.date, input.search)),
  create: adminProcedure
    .input(teacherCreateInputSchema)
    .mutation(({ ctx, input }) =>
      command(ctx.db, (database) => createTeacher({ database, values: input })),
    ),
  update: adminProcedure
    .input(teacherUpdateInputSchema)
    .mutation(({ ctx, input }) =>
      command(ctx.db, (database) => updateTeacher({ database, values: input })),
    ),
  week: adminProcedure.input(teacherWeekInputSchema).query(async ({ ctx, input }) => {
    await readTeacher(ctx.db, input.id);
    const anchor = new Date(input.week);
    anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));
    return teacherWeek({
      database: ctx.db,
      teacherId: input.id,
      week: anchor.toISOString().slice(0, 10),
      now: ctx.now ?? new Date(),
    });
  }),
  uncovered: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(({ ctx, input }) => uncoveredMeetings(ctx.db, input, ctx.now ?? new Date())),
  previewDeparture: adminProcedure.input(teacherDepartureInputSchema).query(({ ctx, input }) =>
    departurePreview({
      database: ctx.db,
      teacherId: input.id,
      effectiveDate: input.effectiveDate,
      now: ctx.now ?? new Date(),
    }),
  ),
  depart: adminProcedure
    .input(teacherDepartureInputSchema.extend({ token: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      command(ctx.db, (database) =>
        scheduleDeparture({
          database,
          teacherId: input.id,
          effectiveDate: input.effectiveDate,
          token: input.token,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      ),
    ),
  substitute: adminProcedure.input(classSubstituteInputSchema).mutation(({ ctx, input }) =>
    command(ctx.db, (database) =>
      substituteMeeting({
        database,
        classId: input.classId,
        slotId: input.scheduleSlotId ?? null,
        sessionId: input.classSessionId ?? null,
        date: input.date,
        teacherId: input.teacherId,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  assignClass: adminProcedure.input(classTeacherAssignInputSchema).mutation(({ ctx, input }) =>
    command(ctx.db, (database) =>
      assignClassTeacher({
        database,
        ...input,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
});
