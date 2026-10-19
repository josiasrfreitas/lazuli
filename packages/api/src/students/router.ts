import { searchIds } from "../search.js";
import { enrollmentSubject, studentSubject } from "../activity/subjects.js";
import { activityTransaction, recordActivity } from "../activity/record.js";
import {
  studentCreateInputSchema,
  studentIntakeOptionsSchema,
  studentIntakeEnrollSchema,
  studentIntakeAllocateSchema,
  studentIntakeResumeSchema,
  studentCompletionInputSchema,
  studentIdInputSchema,
  studentListInputSchema,
  studentListOutputSchema,
  studentListRowSchema,
  studentSearchInputSchema,
  studentSetStatusInputSchema,
  studentUpdateContactProcedureInputSchema,
  studentUpdateNotesInputSchema,
  STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH,
  z,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { createStudent, readStudentProfile, searchStudents, updateStudentContact } from "./data.js";
import { listStudents, previewStudent } from "./list.js";
import { setStudentStatus } from "./status.js";
import { readStudentPedagogy } from "./pedagogy.js";
import { readStudentAttendanceHistory } from "./attendance-history.js";
import { completeStudent } from "./completion.js";
import { readStudentPedagogy } from "./pedagogy.js";

const FILTER_OPTION_LIMIT = 50;

export const studentsRouter = router({
  resumeIntake: adminProcedure.input(studentIntakeResumeSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, "students.resumeIntake", database => resumeStudentIntake({
      database, values: input, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date(),
    }), async (result, database) => {
      const subject = await studentSubject(database, result.studentId);
      if (result.contractId) await recordActivity(database, ctx, "finance.createMonthlyContract", {
        subject: { type: "contract", id: result.contractId, name: subject.name },
        deduplicationKey: `finance.contract:${result.contractId}`,
      });
      return { subject };
    }),
  ),
  pendingActions: adminProcedure.input(studentIdInputSchema).query(({ ctx, input }) => readStudentPendingActions(ctx.db, input.id, ctx.now ?? new Date())),
  allocate: adminProcedure.input(studentIntakeAllocateSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, "enrollment.create", database => allocateIntakeStudent({
      database, values: input, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date(),
    }), async (result, database) => ({ subject: await enrollmentSubject(database, result.enrollmentId), deduplicationKey: `enrollment.create:${result.enrollmentId}` })),
  ),
  intakeOptions: adminProcedure.input(studentIntakeOptionsSchema).query(({ ctx, input }) => studentIntakeOptions(ctx.db, input, ctx.now ?? new Date())),
  enrollNew: adminProcedure.input(studentIntakeEnrollSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, "students.enrollNew", database => enrollNewStudent({
      database, values: input, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date(),
    }), async (result, database) => {
      const subject = await studentSubject(database, result.studentId);
      if (result.contractId) await recordActivity(database, ctx, "finance.createMonthlyContract", {
        subject: { type: "contract", id: result.contractId, name: subject.name },
        deduplicationKey: `finance.contract:${result.contractId}`,
      });
      return { subject, deduplicationKey: `students.enrollNew:${result.studentId}` };
    }),
  ),
  listFilterOptions: adminProcedure
    .input(
      z
        .object({
          kind: z.enum(["class", "teacher"]),
          search: z.string().trim().max(STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH).default(""),
          ids: z.array(z.string().uuid()).max(FILTER_OPTION_LIMIT).default([]),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      if (input.kind === "class") {
        const rows = await ctx.db.class.findMany({
          where: {
            deletedAt: null,
            ...(input.ids.length > 0
              ? { id: { in: input.ids } }
              : {
                  id: await searchIds(ctx.db, "Class", input.search),
                }),
          },
          select: { id: true, portalClassName: true },
          orderBy: { portalClassName: "asc" },
          take: FILTER_OPTION_LIMIT,
        });
        return rows.map(({ id, portalClassName }) => ({ id, label: portalClassName }));
      }
      const rows = await ctx.db.user.findMany({
        where: {
          deletedAt: null,
          classesTaught: { some: { deletedAt: null } },
          ...(input.ids.length > 0
            ? { id: { in: input.ids } }
            : { id: await searchIds(ctx.db, "User", input.search) }),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: FILTER_OPTION_LIMIT,
      });
      return rows.map(({ id, name }) => ({ id, label: name }));
    }),
  list: adminProcedure
    .input(studentListInputSchema)
    .output(studentListOutputSchema)
    .query(({ ctx, input }) =>
      listStudents({
        database: ctx.db,
        values: { ...input, now: ctx.now ?? new Date(), staffUserId: ctx.staffUser.id },
      }),
    ),
  preview: adminProcedure
    .input(studentIdInputSchema)
    .output(studentListRowSchema)
    .query(({ ctx, input }) =>
      previewStudent({
        database: ctx.db,
        values: { id: input.id, now: ctx.now ?? new Date(), staffUserId: ctx.staffUser.id },
      }),
    ),
  pedagogy: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) =>
      readStudentPedagogy({ database: ctx.db, id: input.id, now: ctx.now ?? new Date() }),
    ),
  attendanceHistory: adminProcedure
    .input(
      studentIdInputSchema.extend({
        enrollmentId: z.string().uuid().optional(),
        status: z.enum(["ALL", "PRESENT", "ABSENT", "PENDING", "CANCELLED"]).default("ALL"),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(({ ctx, input }) =>
      readStudentAttendanceHistory({ ...input, database: ctx.db, now: ctx.now ?? new Date() }),
    ),
  byId: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) => readStudentProfile({ database: ctx.db, id: input.id })),
  pedagogy: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) =>
      readStudentPedagogy({ database: ctx.db, id: input.id, now: ctx.now ?? new Date() }),
    ),
  search: adminProcedure
    .input(studentSearchInputSchema)
    .query(({ ctx, input }) => searchStudents({ database: ctx.db, values: input })),
  create: adminProcedure.input(studentCreateInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "students.create",
      (database) => createStudent({ database, values: input }),
      async (result, database) => ({
        subject: await studentSubject(database, result.id),
        deduplicationKey: `students.create:${result.id}`,
      }),
    ),
  ),
  completeCreation: adminProcedure.input(studentCompletionInputSchema).mutation(({ ctx, input }) =>
    completeStudent({
      database: ctx.db,
      values: input,
      staffUser: ctx.staffUser,
      now: ctx.now ?? new Date(),
    }),
  ),
  updateContact: adminProcedure
    .input(studentUpdateContactProcedureInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "students.updateContact",
        (database) => updateStudentContact({ database, id: input.id, values: input.input }),
        async (_result, database) => ({ subject: await studentSubject(database, input.id) }),
      ),
    ),
  updateNotes: adminProcedure.input(studentUpdateNotesInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "students.updateNotes",
      (database) =>
        database.student.update({
          where: { id: input.id },
          data: { notes: input.notes ?? null },
          select: { id: true },
        }),
      async (_result, database) => ({ subject: await studentSubject(database, input.id) }),
    ),
  ),
  setStatus: adminProcedure.input(studentSetStatusInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "students.setStatus",
      (database) => setStudentStatus({ database, values: input }),
      async (_result, database) => ({
        subject: await studentSubject(database, input.id),
        description: `Situação: ${{ ACTIVE: "Ativo", INACTIVE: "Inativo", DROPPED: "Desistente", SUSPENDED: "Pausado" }[input.status]}.`,
      }),
    ),
  ),
});
