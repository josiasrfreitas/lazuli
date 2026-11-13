import { teacherMetrics } from "./metrics.js";
import { teacherUploadsRouter } from "./upload-sessions.js";
import { listTeacherFiles } from "./files.js";
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
import type { Context, StaffUser } from "../trpc/context.js";
import { activityTransaction, type ActivityDetails } from "../activity/record.js";
import { teacherSubject, classSubject } from "../activity/subjects.js";
import type { ActivityAction } from "../activity/catalog.js";
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
import { teacherAgenda } from "./agenda.js";
import { teacherWeek } from "./schedule.js";
import { lockTeacher } from "./availability.js";
const MAX_PAGE_SIZE = 100;
const DEFAULT_CLASS_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 80;
const DAYS_AFTER_MONDAY = 6;
const DAYS_PER_WEEK = 7;
const ISO_DATE_LENGTH = 10;
const DEFAULT_PAGE_SIZE = 25;

async function command<T>(
  context: { db: Context["db"]; staffUser: StaffUser; now?: Date | undefined },
  options: {
    action: ActivityAction;
    work: (tx: Prisma.TransactionClient) => Promise<T>;
    describe: (result: T, database: Prisma.TransactionClient) => Promise<ActivityDetails>;
  },
): Promise<T> {
  const { action, work, describe } = options;

  try {
    return await activityTransaction(context, {
      action,
      work: async (tx) => {
        await lockTeacher(tx, "");
        return work(tx);
      },
      describe,
      options: { timeout: 15_000 },
    });
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
  metrics: adminProcedure
    .input(teacherIdInputSchema)
    .query(({ ctx, input }) =>
      teacherMetrics(ctx.db, { teacherId: input.id, now: ctx.now ?? new Date() }),
    ),
  uploads: teacherUploadsRouter,
  files: adminProcedure
    .input(teacherIdInputSchema)
    .query(({ ctx, input }) => listTeacherFiles(ctx, input.id)),
  classes: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_CLASS_PAGE_SIZE),
      }),
    )
    .query(({ ctx, input }) =>
      teacherClasses({ database: ctx.db, input, now: ctx.now ?? new Date() }),
    ),
  list: adminProcedure
    .input(teacherListInputSchema)
    .query(({ ctx, input }) =>
      listTeachers({ database: ctx.db, input, now: ctx.now ?? new Date() }),
    ),
  byId: adminProcedure.input(teacherIdInputSchema).query(async ({ ctx, input }) => {
    const now = ctx.now ?? new Date();
    const teacher = await readTeacher(ctx.db, input.id);
    return {
      ...teacher,
      today: saoPauloDateOnly(now),
      studentCount: await teacherStudentCount({ database: ctx.db, teacherId: input.id, now }),
    };
  }),
  options: adminProcedure
    .input(
      z.object({ date: civilDateSchema, search: z.string().max(MAX_SEARCH_LENGTH).default("") }),
    )
    .query(({ ctx, input }) =>
      teacherOptions({ database: ctx.db, date: input.date, search: input.search }),
    ),
  create: adminProcedure.input(teacherCreateInputSchema).mutation(({ ctx, input }) =>
    command(ctx, {
      action: "teachers.create",
      work: (database) =>
        createTeacher({
          database,
          values: input,
          actorRole: ctx.staffUser.role,
          actorId: ctx.staffUser.id,
        }),
      describe: async (result, database) => ({
        subject: await teacherSubject(database, result.id),
        deduplicationKey: `teachers.create:${result.id}`,
      }),
    }),
  ),
  update: adminProcedure.input(teacherUpdateInputSchema).mutation(({ ctx, input }) =>
    command(ctx, {
      action: "teachers.update",
      work: (database) =>
        updateTeacher({
          database,
          values: input,
          actorRole: ctx.staffUser.role,
          actorId: ctx.staffUser.id,
        }),
      describe: async (_result, database) => ({
        subject: await teacherSubject(database, input.id),
        description: input.isEnabled
          ? "Acesso ao sistema habilitado."
          : "Acesso ao sistema desabilitado.",
      }),
    }),
  ),
  agenda: adminProcedure.input(teacherIdInputSchema).query(async ({ ctx, input }) => {
    await readTeacher(ctx.db, input.id);
    return teacherAgenda({ database: ctx.db, teacherId: input.id, now: ctx.now ?? new Date() });
  }),
  week: adminProcedure.input(teacherWeekInputSchema).query(async ({ ctx, input }) => {
    await readTeacher(ctx.db, input.id);
    const anchor = new Date(input.week);
    anchor.setUTCDate(
      anchor.getUTCDate() - ((anchor.getUTCDay() + DAYS_AFTER_MONDAY) % DAYS_PER_WEEK),
    );
    return teacherWeek({
      database: ctx.db,
      teacherId: input.id,
      week: anchor.toISOString().slice(0, ISO_DATE_LENGTH),
      now: ctx.now ?? new Date(),
    });
  }),
  uncovered: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      }),
    )
    .query(({ ctx, input }) =>
      uncoveredMeetings({ database: ctx.db, input, now: ctx.now ?? new Date() }),
    ),
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
      command(ctx, {
        action: "teachers.depart",
        work: (database) =>
          scheduleDeparture({
            database,
            teacherId: input.id,
            effectiveDate: input.effectiveDate,
            token: input.token,
            recordedById: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          }),
        describe: async (_result, database) => ({
          subject: await teacherSubject(database, input.id),
          description: `Saída em ${input.effectiveDate.split("-").toReversed().join("/")}.`,
        }),
      }),
    ),
  substitute: adminProcedure.input(classSubstituteInputSchema).mutation(({ ctx, input }) =>
    command(ctx, {
      action: "teachers.substitute",
      work: (database) =>
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
      describe: async (_result, database) => ({
        subject: await classSubject(database, input.classId),
        description: `Substituição em ${input.date.split("-").toReversed().join("/")}.`,
      }),
    }),
  ),
  assignClass: adminProcedure.input(classTeacherAssignInputSchema).mutation(({ ctx, input }) =>
    command(ctx, {
      action: "teachers.assignClass",
      work: (database) =>
        assignClassTeacher({
          database,
          ...input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      describe: async (_result, database) => {
        const subject = await classSubject(database, input.classId);
        const teacher = await teacherSubject(database, input.teacherId);
        return { subject, description: `Docente: ${teacher.name}.` };
      },
    }),
  ),
});
