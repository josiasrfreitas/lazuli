import { attachDocumentSession } from "../student-documents/router.js";
import {
  studentIntakeOptions,
  enrollNewStudent,
  allocateIntakeStudent,
  resumeStudentIntake,
} from "./intake.js";
import { readStudentPendingActions } from "./pending-actions.js";
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
  civilDateSchema,
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
import { readStudentHealth } from "./health.js";
import { readStudentAgenda } from "./agenda.js";

const FILTER_OPTION_LIMIT = 50;
const MAX_AGENDA_DAYS = 31;
const DAY_MS = 86_400_000;

export const studentsRouter = router({
  health: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) =>
      readStudentHealth({ database: ctx.db, id: input.id, now: ctx.now ?? new Date() }),
    ),
  agenda: adminProcedure
    .input(
      studentIdInputSchema
        .extend({ from: civilDateSchema, to: civilDateSchema })
        .refine(
          ({ from, to }) =>
            to >= from && Date.parse(to) - Date.parse(from) <= MAX_AGENDA_DAYS * DAY_MS,
          { message: "Escolha um período de até 31 dias." },
        ),
    )
    .query(({ ctx, input }) =>
      readStudentAgenda(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  resumeIntake: adminProcedure.input(studentIntakeResumeSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "students.resumeIntake",
      work: async (database) => {
        const result = await resumeStudentIntake({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
        await attachDocumentSession(database, {
          sessionId: input.documentSessionId,
          studentId: result.studentId,
          ownerId: ctx.staffUser.id,
        });
        return result;
      },
      describe: async (result, database) => {
        const subject = await studentSubject(database, result.studentId);
        if (result.contractId)
          await recordActivity(database, {
            context: ctx,
            action: "finance.createMonthlyContract",
            details: {
              subject: { type: "contract", id: result.contractId, name: subject.name },
              deduplicationKey: `finance.contract:${result.contractId}`,
            },
          });
        return { subject };
      },
    }),
  ),
  pendingActions: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) =>
      readStudentPendingActions(ctx.db, { id: input.id, now: ctx.now ?? new Date() }),
    ),
  allocate: adminProcedure.input(studentIntakeAllocateSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "enrollment.create",
      work: (database) =>
        allocateIntakeStudent({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      describe: async (result, database) => ({
        subject: await enrollmentSubject(database, result.enrollmentId),
        deduplicationKey: `enrollment.create:${result.enrollmentId}`,
      }),
    }),
  ),
  intakeOptions: adminProcedure
    .input(studentIntakeOptionsSchema)
    .query(({ ctx, input }) => studentIntakeOptions(ctx.db, { input, now: ctx.now ?? new Date() })),
  enrollNew: adminProcedure.input(studentIntakeEnrollSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "students.enrollNew",
      work: async (database) => {
        const result = await enrollNewStudent({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
        await attachDocumentSession(database, {
          sessionId: input.documentSessionId,
          studentId: result.studentId,
          ownerId: ctx.staffUser.id,
        });
        return result;
      },
      describe: async (result, database) => {
        const subject = await studentSubject(database, result.studentId);
        if (result.contractId)
          await recordActivity(database, {
            context: ctx,
            action: "finance.createMonthlyContract",
            details: {
              subject: { type: "contract", id: result.contractId, name: subject.name },
              deduplicationKey: `finance.contract:${result.contractId}`,
            },
          });
        return { subject, deduplicationKey: `students.enrollNew:${result.studentId}` };
      },
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
                  id: (await searchIds(ctx.db, { table: "Class", query: input.search })) ?? {},
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
            : { id: (await searchIds(ctx.db, { table: "User", query: input.search })) ?? {} }),
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
    .query(({ ctx, input }) =>
      readStudentProfile({ database: ctx.db, id: input.id, now: ctx.now ?? new Date() }),
    ),
  search: adminProcedure
    .input(studentSearchInputSchema)
    .query(({ ctx, input }) => searchStudents({ database: ctx.db, values: input })),
  create: adminProcedure.input(studentCreateInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "students.create",
      work: (database) => createStudent({ database, values: input }),
      describe: async (result, database) => ({
        subject: await studentSubject(database, result.id),
        deduplicationKey: `students.create:${result.id}`,
      }),
    }),
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
      activityTransaction(ctx, {
        action: "students.updateContact",
        work: (database) => updateStudentContact({ database, id: input.id, values: input.input }),
        describe: async (_result, database) => ({
          subject: await studentSubject(database, input.id),
        }),
      }),
    ),
  updateNotes: adminProcedure.input(studentUpdateNotesInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "students.updateNotes",
      work: (database) =>
        database.student.update({
          where: { id: input.id },
          data: { notes: input.notes ?? null },
          select: { id: true },
        }),
      describe: async (_result, database) => ({
        subject: await studentSubject(database, input.id),
      }),
    }),
  ),
  setStatus: adminProcedure.input(studentSetStatusInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "students.setStatus",
      work: (database) => setStudentStatus({ database, values: input }),
      describe: async (_result, database) => ({
        subject: await studentSubject(database, input.id),
        description: `Situação: ${{ ACTIVE: "Ativo", INACTIVE: "Inativo", DROPPED: "Desistente", SUSPENDED: "Pausado" }[input.status]}.`,
      }),
    }),
  ),
});
