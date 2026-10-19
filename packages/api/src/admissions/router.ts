import { leadSubject, visitSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
import {
  captureLead,
  updateLeadDetails,
} from "./capture.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  z,
  leadCaptureSchema,
  leadRegistrationSchema,
  admissionIdSchema,
  admissionSaveSchema,
  admissionListSchema,
  admissionMatchesSchema,
  entryVisitScheduleSchema,
  entryVisitCalendarSchema,
  entryVisitGuestsSchema,
  entryVisitOutcomeSchema,
  admissionEnrollSchema,
  placementCalendarSchema,
  placementScheduleSchema,
  placementFileSchema,
  placementResultSchema,
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
import { visitCalendar } from "./visit-calendar.js";
import { candidateVisits } from "./visit-read.js";
import { enrollCandidate } from "./enroll.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { lockTeacher, assertTeacherEligible } from "../teachers/availability.js";
import { admissionStages } from "./catalog.js";
import { placementCalendar, schedulePlacement, uploadPlacementFile, downloadPlacementFile, recordPlacementResult } from "./placement.js";

export const admissionsRouter = router({
  assignPlacement: adminProcedure.input(z.object({ id: z.string().uuid(), teacherId: z.string().uuid().nullable() }).strict()).mutation(({ ctx, input }) => activityTransaction(ctx, "admissions.placementSchedule", async (database) => {
    await lockTeacher(database, "");
    const visit = await database.entryVisit.findFirst({ where: { id: input.id, kind: "PLACEMENT", deletedAt: null } });
    if (!visit || visit.status === "CANCELLED") throw badRequest("Nivelamento indisponível para atribuição.");
    await lockCandidate(database, visit.candidateId);
    if (input.teacherId) await assertTeacherEligible({ database, teacherId: input.teacherId, date: saoPauloDateOnly(ctx.now ?? new Date()) });
    return database.entryVisit.update({ where: { id: visit.id }, data: { teacherId: input.teacherId }, select: { id: true } });
  }, async (_result, database) => ({ subject: await visitSubject(database, input.id), description: "Atualizou o professor responsável pelo nivelamento." }))),
  visitCalendar: adminProcedure.input(entryVisitCalendarSchema).query(({ ctx, input }) => visitCalendar(ctx.db, input, ctx.now ?? new Date())),
  stages: adminProcedure.query(({ ctx }) => admissionStages(ctx.db)),
  placementCalendar: adminProcedure.input(placementCalendarSchema).query(({ ctx, input }) => placementCalendar(ctx.db, input)),
  placementSchedule: adminProcedure.input(placementScheduleSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, "admissions.placementSchedule", database => schedulePlacement({
      database, values: input, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date(),
    }), async (_result, database) => ({ subject: await leadSubject(database, input.candidateId) })),
  ),
  placementUpload: adminProcedure.input(placementFileSchema).mutation(({ ctx, input }) => uploadPlacementFile(ctx, input)),
  placementDownload: adminProcedure.input(admissionIdSchema).mutation(({ ctx, input }) => downloadPlacementFile(ctx.db, input.id)),
  placementResult: adminProcedure.input(placementResultSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, "admissions.placementResult", database => recordPlacementResult({
      database, values: input, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date(),
    }), async (_result, database) => ({ subject: await visitSubject(database, input.id) })),
  ),
  details: adminProcedure.input(leadCaptureSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "admissions.details",
      (database) =>
        updateLeadDetails({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (_result, database) => ({ subject: await leadSubject(database, input.id) }),
    ),
  ),
  capture: adminProcedure.input(leadRegistrationSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "admissions.capture",
      async (database) => {
        await lockTeacher(database, "");
        const result = await captureLead({ database, values: input.lead, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date() });
        if (input.placement) await schedulePlacement({ database, values: input.placement, recordedById: ctx.staffUser.id, now: ctx.now ?? new Date() });
        return result;
      },
      async (result, database) => ({
        subject: await leadSubject(database, result.id),
        deduplicationKey: `admissions.capture:${result.id}`,
      }),
    ),
  ),
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
    activityTransaction(
      ctx,
      "admissions.save",
      (database) =>
        saveCandidate({
          database,
          input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (_result, database) => ({ subject: await leadSubject(database, input.id) }),
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
    activityTransaction(
      ctx,
      "admissions.schedule",
      (database) =>
        scheduleVisit({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (result, database) => ({
        subject: await leadSubject(database, input.candidateId),
        deduplicationKey: `admissions.schedule:${result.id}`,
      }),
    ),
  ),
  outcome: adminProcedure.input(entryVisitOutcomeSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "admissions.outcome",
      (database) =>
        recordVisitOutcome({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (_result, database) => ({ subject: await visitSubject(database, input.id) }),
    ),
  ),
  enroll: adminProcedure.input(admissionEnrollSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "admissions.enroll",
      (database) =>
        enrollCandidate({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (_result, database) => ({
        subject: await leadSubject(database, input.id),
        deduplicationKey: `admissions.enroll:${input.id}`,
      }),
    ),
  ),
  setStatus: adminProcedure
    .input(admissionIdSchema.extend({ status: z.enum(["WAITING", "ARCHIVED"]) }))
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "admissions.setStatus",
        async (database) => {
          await lockTeacher(database, "");
          await lockCandidate(database, input.id);
          const candidate = await readCandidate(database, input.id);
          if (candidate.enrollmentId)
            throw badRequest("O lead já foi matriculado. Gerencie o vínculo na turma.");
          if (
            input.status === "ARCHIVED" &&
            (await database.entryVisit.count({
              where: { candidateId: input.id, status: "SCHEDULED", deletedAt: null },
            }))
          )
            throw badRequest("Conclua ou cancele os atendimentos e aulas experimentais pendentes antes de arquivar.");
          return database.admissionCandidate.update({
            where: { id: input.id },
            data: {
              status: input.status,
              recordedById: ctx.staffUser.id,
            },
            select: { id: true },
          });
        },
        async (_result, database) => ({
          subject: await leadSubject(database, input.id),
          description:
            input.status === "ARCHIVED" ? "Lead arquivado." : "Lead reaberto.",
        }),
      ),
    ),
});
