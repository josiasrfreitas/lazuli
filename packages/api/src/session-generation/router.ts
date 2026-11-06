import { z } from "@lazuli/validators";
import { createServiceLogger, logDevelopmentProcess } from "@lazuli/logging";
import { saoPauloDateOnly } from "@lazuli/domain";
import { staffProcedure, router } from "../trpc/init.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { GENERATION_STALE_MS } from "./requests.js";
import type { Prisma } from "@lazuli/db";
const processLogger = createServiceLogger("web");

const statusSelect = {
  id: true,
  portalClassName: true,
  ...responsibilitySelect,
  sessionGenerationRequests: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      failureCode: true,
      sessionsCreated: true,
      sessionsPlanned: true,
      requestedBy: { select: { name: true } },
    },
  },
  _count: { select: { sessions: { where: { deletedAt: null } } } },
} satisfies Prisma.ClassSelect;
type StatusRow = Prisma.ClassGetPayload<{ select: typeof statusSelect }>;
type GenerationStatus = {
  classId: string;
  className: string;
  request: StatusRow["sessionGenerationRequests"][number] | null;
  pending: boolean;
  stale: boolean;
  sessionCount: number;
  canGenerate: boolean;
};

function generationStatus(
  row: StatusRow,
  { now, canRequest }: { now: Date; canRequest: boolean },
): GenerationStatus {
  const request = row.sessionGenerationRequests[0] ?? null;
  const pending = request !== null && ["PENDING", "QUEUED", "RUNNING"].includes(request.status);
  const stale =
    pending &&
    now.getTime() - (request.startedAt ?? request.createdAt).getTime() >= GENERATION_STALE_MS;
  return {
    classId: row.id,
    className: row.portalClassName,
    request,
    pending,
    stale,
    sessionCount: row._count.sessions,
    canGenerate: canRequest && (!pending || stale),
  };
}

export const sessionGenerationRouter = router({
  status: staffProcedure
    .input(
      z
        .object({
          classId: z.string().uuid().optional(),
          from: z.string().date().optional(),
          to: z.string().date().optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const now = ctx.now ?? new Date();
      const date = new Date(input.from ?? saoPauloDateOnly(now));
      const classes = await ctx.db.class.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          ...(input.classId ? { id: input.classId } : {}),
          ...(input.from && input.to
            ? {
                semester: {
                  startDate: { lte: new Date(input.to) },
                  endDate: { gte: new Date(input.from) },
                },
              }
            : {}),
        },
        select: statusSelect,
        orderBy: { portalClassName: "asc" },
      });
      const status = classes
        .filter(
          (row) =>
            ctx.staffUser.role !== "TEACHER" || usualTeacherOn(row, date)?.id === ctx.staffUser.id,
        )
        .map((row) => generationStatus(row, { now, canRequest: ctx.staffUser.role !== "TEACHER" }));
      logDevelopmentProcess(processLogger, {
        requestId: ctx.requestId,
        userId: ctx.staffUser.id,
        resource: "sessionGeneration.status",
        operation: "DB",
        step: "Session generation status evaluated",
        facts: {
          classes: status.length,
          pending_generations: status.filter((row) => row.pending).length,
          stale_generations: status.filter((row) => row.stale).length,
        },
      });
      return status;
    }),
});
