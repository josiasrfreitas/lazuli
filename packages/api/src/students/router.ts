import { studentSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
import {
  studentCreateInputSchema,
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
import { completeStudent } from "./completion.js";

const FILTER_OPTION_LIMIT = 50;

export const studentsRouter = router({
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
                  OR: [
                    { internalCode: { contains: input.search, mode: "insensitive" as const } },
                    { portalClassName: { contains: input.search, mode: "insensitive" as const } },
                  ],
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
            : { name: { contains: input.search, mode: "insensitive" as const } }),
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
  byId: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) => readStudentProfile({ database: ctx.db, id: input.id })),
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
  completeCreation: adminProcedure
    .input(studentCompletionInputSchema)
    .mutation(({ ctx, input }) =>
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
