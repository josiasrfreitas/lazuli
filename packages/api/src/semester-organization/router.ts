import { assignLeadInterest, leadInterestSchema } from "./lead-interest.js";
import { prepareSemester } from "./prepare.js";
import { moveSchema, declineSchema, movePlacements, declinePlacements } from "./commands.js";
import {
  z,
  semesterScopeSchema,
  semesterPlanSchema,
  semesterPlacementSchema,
  publishSemesterSchema,
  withdrawSemesterSchema,
} from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import type { Context, StaffUser } from "../trpc/context.js";
import { readSemester } from "./queries.js";
import { organizationStudent, organizationStudents } from "./students.js";
import { saveClassPlan, savePlacement } from "./write.js";
import { publishPlacements, withdrawPlacement } from "./publish.js";
import { dispatchSessionGeneration } from "../session-generation/requests.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { OrganizationContext } from "./data.js";
import {
  continuitySchema,
  saveContinuity,
  pendingLeadSchema,
  pendingLead,
  planLifecycleSchema,
  changePlanStatus,
} from "./lifecycle.js";

const MIN_HOLIDAY_YEAR = 2000;
const MAX_HOLIDAY_YEAR = 2100;
const HOLIDAY_REQUEST_TIMEOUT_MS = 8000;
const MAX_STUDENT_SEARCH_LENGTH = 100;

const ISO_DATE_LENGTH = 10;

const context = (ctx: {
  db: Context["db"];
  staffUser: StaffUser;
  now?: Date | undefined;
}): OrganizationContext => ({
  database: ctx.db,
  staffUser: ctx.staffUser,
  now: ctx.now ?? new Date(),
});
export const semesterOrganizationRouter = router({
  assignLeadInterest: adminProcedure
    .input(leadInterestSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => assignLeadInterest({ ...context(ctx), database }, input)),
    ),
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
      const placements = await ctx.db.semesterPlacement.findMany({
        where: {
          studentId: input.studentId,
          deletedAt: null,
          semester: {
            endDate: { gte: new Date(saoPauloDateOnly(ctx.now ?? new Date())) },
            deletedAt: null,
          },
        },
        include: {
          semester: { select: { id: true, name: true, startDate: true, endDate: true } },
          plan: { select: { name: true } },
          stage: { select: { internalCode: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return placements.map((placement) => ({ semester: placement.semester, placement }));
    }),
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
  holidays: adminProcedure
    .input(z.object({ year: z.number().int().min(MIN_HOLIDAY_YEAR).max(MAX_HOLIDAY_YEAR) }))
    .query(async ({ input }) => {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${input.year}`, {
        signal: AbortSignal.timeout(HOLIDAY_REQUEST_TIMEOUT_MS),
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
    ctx.db.period.findMany({ orderBy: { startDate: "desc" } }),
  ),
  detail: adminProcedure
    .input(semesterScopeSchema)
    .query(({ ctx, input }) => readSemester(context(ctx), input.semesterId)),
  students: adminProcedure
    .input(
      semesterScopeSchema.extend({
        search: z.string().trim().max(MAX_STUDENT_SEARCH_LENGTH).default(""),
        page: z.number().int().min(1).default(1),
        unassigned: z.boolean().default(true),
      }),
    )
    .query(({ ctx, input }) => organizationStudents(context(ctx), input)),
  student: adminProcedure
    .input(semesterScopeSchema.extend({ studentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      organizationStudent(context(ctx), {
        studentId: input.studentId,
        semesterId: input.semesterId,
      }),
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
          const semester = await database.period.findUniqueOrThrow({
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
