import {
  z,
  assessmentProgressSchema,
  assessmentSaveSchema,
  assessmentConfirmSchema,
} from "@lazuli/validators";
import { adminProcedure, router, staffProcedure } from "../trpc/init.js";
import {
  assessmentClasses,
  readAssessment,
  readClassAssessments,
  readStudentAssessments,
} from "./read.js";
import { saveAssessment, confirmAssessment } from "./write.js";

export const assessmentsRouter = router({
  classes: staffProcedure.query(({ ctx }) =>
    assessmentClasses({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }),
  ),
  byProgress: staffProcedure
    .input(assessmentProgressSchema)
    .query(({ ctx, input }) =>
      readAssessment(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.progressId,
      ),
    ),
  student: staffProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      readStudentAssessments(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.studentId,
      ),
    ),
  class: staffProcedure
    .input(z.object({ classId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      readClassAssessments(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.classId,
      ),
    ),
  save: staffProcedure
    .input(assessmentSaveSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        saveAssessment({ database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input),
      ),
    ),
  confirm: adminProcedure
    .input(assessmentConfirmSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        confirmAssessment(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          input,
        ),
      ),
    ),
});
