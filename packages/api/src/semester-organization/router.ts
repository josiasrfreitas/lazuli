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
const context = (ctx: Context & { staffUser: StaffUser }) => ({
  database: ctx.db,
  staffUser: ctx.staffUser,
  now: ctx.now ?? new Date(),
});
export const semesterOrganizationRouter = router({
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
  savePlan: adminProcedure
    .input(semesterPlanSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => saveClassPlan({ ...context(ctx), database }, input)),
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
