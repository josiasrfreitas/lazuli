import { prepareSemester } from "./prepare.js";
import {
  moveSchema,
  declineSchema,
  closedRangeSchema,
  periodSchema,
  updatePeriod,
  movePlacements,
  declinePlacements,
  closeRange,
} from "./commands.js";
import {
  z,
  semesterScopeSchema,
  semesterPlanSchema,
  semesterPlacementSchema,
  studentAvailabilitySchema,
  invalidateAvailabilitySchema,
  publishSemesterSchema,
  withdrawSemesterSchema,
} from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import type { Context, StaffUser } from "../trpc/context.js";
import { readSemester } from "./queries.js";
import { organizationStudent, organizationStudents } from "./students.js";
import {
  saveClassPlan,
  savePlacement,
  confirmAvailability,
  invalidateAvailability,
} from "./write.js";
import { publishPlacements, withdrawPlacement } from "./publish.js";
import { dispatchSessionGeneration } from "../session-generation/requests.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  continuitySchema,
  saveContinuity,
  pendingLeadSchema,
  pendingLead,
  planLifecycleSchema,
  changePlanStatus,
} from "./lifecycle.js";

const ISO_DATE_LENGTH = 10;

const context = (ctx: { db: Context["db"]; staffUser: StaffUser; now?: Date | undefined }) => ({
  database: ctx.db,
  staffUser: ctx.staffUser,
  now: ctx.now ?? new Date(),
});
export const semesterOrganizationRouter = router({
  continuity: adminProcedure
    .input(continuitySchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => saveContinuity({ ...context(ctx), database }, input)),
    ),
  pendingLead: adminProcedure
    .input(pendingLeadSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => pendingLead({ ...context(ctx), database }, input)),
    ),
  planStatus: adminProcedure.input(planLifecycleSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.db.$transaction((database) =>
      changePlanStatus({ ...context(ctx), database }, input),
    );
    if (result.generationRequestId)
      await dispatchSessionGeneration({
        database: ctx.db,
        requestId: result.generationRequestId,
        ...(ctx.sessionGenerationQueue ? { queue: ctx.sessionGenerationQueue } : {}),
      });
    return result;
  }),
  studentIntent: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.studentAvailability.findMany({
        where: {
          studentId: input.studentId,
          deletedAt: null,
          semester: {
            endDate: { gte: new Date(saoPauloDateOnly(ctx.now ?? new Date())) },
            deletedAt: null,
          },
        },
        orderBy: { createdAt: "desc" },
        include: { semester: { select: { id: true, name: true, startDate: true, endDate: true } } },
      });
      const placements = await ctx.db.semesterPlacement.findMany({
        where: {
          studentId: input.studentId,
          deletedAt: null,
          semesterId: { in: records.map((record) => record.semesterId) },
        },
        include: { plan: { select: { name: true } }, stage: { select: { internalCode: true } } },
      });
      return records
        .filter(
          (record, index) =>
            records.findIndex((candidate) => candidate.semesterId === record.semesterId) === index,
        )
        .map((record) => ({
          semester: record.semester,
          confirmed: record.confirmed,
          notes: record.notes,
          placement:
            placements.find((placement) => placement.semesterId === record.semesterId) ?? null,
        }));
    }),
  updatePeriod: adminProcedure
    .input(periodSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => updatePeriod({ ...context(ctx), database }, input)),
    ),
  prepare: adminProcedure
    .input(semesterScopeSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) => prepareSemester({ ...context(ctx), database }, input.semesterId),
        { timeout: 30_000 },
      ),
    ),
  move: adminProcedure.input(moveSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => movePlacements({ ...context(ctx), database }, input), {
      timeout: 30_000,
    }),
  ),
  decline: adminProcedure.input(declineSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => declinePlacements({ ...context(ctx), database }, input), {
      timeout: 30_000,
    }),
  ),
  closeRange: adminProcedure
    .input(closedRangeSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => closeRange({ ...context(ctx), database }, input)),
    ),
  holidays: adminProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ input }) => {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${input.year}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error(
          "A fonte de feriados está indisponível. Tente novamente ou cadastre a data manualmente.",
        );
      return z
        .array(z.object({ date: z.string(), name: z.string(), type: z.string() }))
        .parse(await response.json());
    }),
  semesters: adminProcedure.query(({ ctx }) =>
    ctx.db.semester.findMany({ orderBy: { startDate: "desc" } }),
  ),
  detail: adminProcedure
    .input(semesterScopeSchema)
    .query(({ ctx, input }) => readSemester(context(ctx), input.semesterId)),
  students: adminProcedure
    .input(
      semesterScopeSchema.extend({
        search: z.string().trim().max(100).default(""),
        page: z.number().int().min(1).default(1),
        unassigned: z.boolean().default(true),
      }),
    )
    .query(({ ctx, input }) => organizationStudents(context(ctx), input)),
  student: adminProcedure
    .input(semesterScopeSchema.extend({ studentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      organizationStudent(context(ctx), input.studentId, input.semesterId),
    ),
  history: adminProcedure.input(z.object({ id: z.string().uuid() })).query(({ ctx, input }) =>
    ctx.db.semesterPlacementRevision.findMany({
      where: { placementId: input.id },
      orderBy: { version: "desc" },
      include: { recordedBy: { select: { name: true } } },
      take: 40,
    }),
  ),
  savePlan: adminProcedure.input(semesterPlanSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction(
      async (database) => {
        const scoped = { ...context(ctx), database };
        const result = await saveClassPlan(scoped, input);
        if (input.placements?.length) {
          const semester = await database.semester.findUniqueOrThrow({
            where: { id: input.semesterId },
          });
          await movePlacements(scoped, {
            semesterId: input.semesterId,
            planId: result.id,
            selections: input.placements,
            effectiveDate: [
              semester.startDate.toISOString().slice(0, ISO_DATE_LENGTH),
              saoPauloDateOnly(scoped.now),
            ]
              .toSorted()
              .at(-1)!,
            reason: "Turma formada a partir da fila de alocação.",
          });
        }
        return result;
      },
      { timeout: 30_000 },
    ),
  ),
  savePlacement: adminProcedure
    .input(semesterPlacementSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => savePlacement({ ...context(ctx), database }, input)),
    ),
  confirmAvailability: adminProcedure
    .input(studentAvailabilitySchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => confirmAvailability({ ...context(ctx), database }, input)),
    ),
  invalidateAvailability: adminProcedure
    .input(invalidateAvailabilitySchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        invalidateAvailability({ ...context(ctx), database }, input),
      ),
    ),
  publish: adminProcedure.input(publishSemesterSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.db.$transaction(
      (database) => publishPlacements({ ...context(ctx), database }, input),
      { timeout: 30_000 },
    );
    const generation = result.generationRequestId
      ? await dispatchSessionGeneration({
          database: ctx.db,
          requestId: result.generationRequestId,
          ...(ctx.sessionGenerationQueue ? { queue: ctx.sessionGenerationQueue } : {}),
        })
      : null;
    return { classId: result.classId, count: result.count, generation };
  }),
  withdraw: adminProcedure
    .input(withdrawSemesterSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => withdrawPlacement({ ...context(ctx), database }, input)),
    ),
});
