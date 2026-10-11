import { saoPauloDateOnly } from "@lazuli/domain";
import {
  z,
  admissionIdSchema,
  admissionSaveSchema,
  admissionListSchema,
  admissionMatchesSchema,
  entryVisitScheduleSchema,
  entryVisitGuestsSchema,
  entryVisitOutcomeSchema,
  admissionEnrollSchema,
} from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { badRequest } from "../trpc/errors.js";
import {
  assertAllocatable,
  listCandidates,
  lockCandidate,
  matchingClasses,
  readCandidate,
  saveCandidate,
} from "./candidates.js";
import { recordVisitOutcome, scheduleVisit } from "./visits.js";
import { candidateVisits } from "./visit-read.js";
import { enrollCandidate } from "./enroll.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { lockTeacher } from "../teachers/availability.js";

export const admissionsRouter = router({
  guests: adminProcedure.input(entryVisitGuestsSchema).query(({ ctx, input }) =>
    ctx.db.entryVisit.findMany({
      where: {
        kind: "TRIAL",
        deletedAt: null,
        classId: input.classId,
        date: new Date(input.date),
        ...(input.scheduleSlotId
          ? { scheduleSlotId: input.scheduleSlotId }
          : { classSessionId: input.classSessionId }),
      },
      select: { id: true, status: true, candidate: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ),
  list: adminProcedure
    .input(admissionListSchema)
    .query(({ ctx, input }) => listCandidates(ctx.db, { input, now: ctx.now ?? new Date() })),
  byId: adminProcedure.input(admissionIdSchema).query(async ({ ctx, input }) => ({
    ...(await readCandidate(ctx.db, input.id)),
    visits: await candidateVisits(ctx.db, { id: input.id, now: ctx.now ?? new Date() }),
    today: saoPauloDateOnly(ctx.now ?? new Date()),
  })),
  save: adminProcedure.input(admissionSaveSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      saveCandidate({
        database,
        input,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  matches: adminProcedure
    .input(admissionMatchesSchema)
    .query(({ ctx, input }) => matchingClasses(ctx.db, { id: input.id, date: input.date })),
  meetings: adminProcedure
    .input(admissionMatchesSchema.extend({ classId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const candidate = await readCandidate(ctx.db, input.id);
      assertAllocatable(candidate, input.date);
      const rows = await meetingsBetween({
        database: ctx.db,
        from: input.date,
        through: input.date,
        now: ctx.now ?? new Date(),
      });
      return rows.filter((row) => row.classId === input.classId && !row.cancelled);
    }),
  schedule: adminProcedure.input(entryVisitScheduleSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      scheduleVisit({
        database,
        values: input,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  outcome: adminProcedure.input(entryVisitOutcomeSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      recordVisitOutcome({
        database,
        values: input,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  enroll: adminProcedure.input(admissionEnrollSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      enrollCandidate({
        database,
        values: input,
        recordedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  setStatus: adminProcedure
    .input(admissionIdSchema.extend({ status: z.enum(["WAITING", "ARCHIVED"]) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (database) => {
        await lockTeacher(database, "");
        await lockCandidate(database, input.id);
        const candidate = await readCandidate(database, input.id);
        if (candidate.enrollmentId)
          throw badRequest("O interessado já foi matriculado. Gerencie o vínculo na turma.");
        if (
          input.status === "ARCHIVED" &&
          (await database.entryVisit.count({
            where: { candidateId: input.id, status: "SCHEDULED", deletedAt: null },
          }))
        )
          throw badRequest("Conclua ou cancele as aulas de entrada pendentes antes de arquivar.");
        return database.admissionCandidate.update({
          where: { id: input.id },
          data: { status: input.status, recordedById: ctx.staffUser.id },
          select: { id: true },
        });
      }),
    ),
});
