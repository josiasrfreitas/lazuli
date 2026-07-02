import {
  studentCreateInputSchema,
  studentIdInputSchema,
  studentSearchInputSchema,
  studentSetStatusInputSchema,
  studentUpdateContactProcedureInputSchema,
  studentUpdateNotesInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { createStudent, readStudentProfile, searchStudents, updateStudentContact } from "./data.js";
import { setStudentStatus } from "./status.js";

export const studentsRouter = router({
  byId: adminProcedure
    .input(studentIdInputSchema)
    .query(({ ctx, input }) => readStudentProfile({ database: ctx.db, id: input.id })),
  search: adminProcedure
    .input(studentSearchInputSchema)
    .query(({ ctx, input }) => searchStudents({ database: ctx.db, values: input })),
  create: adminProcedure
    .input(studentCreateInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createStudent({ database, values: input })),
    ),
  updateContact: adminProcedure
    .input(studentUpdateContactProcedureInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        updateStudentContact({ database, id: input.id, values: input.input }),
      ),
    ),
  updateNotes: adminProcedure.input(studentUpdateNotesInputSchema).mutation(({ ctx, input }) =>
    ctx.db.student.update({
      where: { id: input.id },
      data: { notes: input.notes ?? null },
      select: { id: true },
    }),
  ),
  setStatus: adminProcedure
    .input(studentSetStatusInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => setStudentStatus({ database, values: input })),
    ),
});
