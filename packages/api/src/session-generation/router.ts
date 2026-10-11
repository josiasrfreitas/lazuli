import { z } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { staffProcedure, router } from "../trpc/init.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { GENERATION_STALE_MS } from "./requests.js";

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
        select: {
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
        },
        orderBy: { portalClassName: "asc" },
      });
      return classes
        .filter(
          (row) =>
            ctx.staffUser.role !== "TEACHER" || usualTeacherOn(row, date)?.id === ctx.staffUser.id,
        )
        .map((row) => {
          const request = row.sessionGenerationRequests[0] ?? null;
          const pending =
            request !== null && ["PENDING", "QUEUED", "RUNNING"].includes(request.status);
          const stale =
            pending &&
            now.getTime() - (request.startedAt ?? request.createdAt).getTime() >=
              GENERATION_STALE_MS;
          return {
            classId: row.id,
            className: row.portalClassName,
            request,
            pending,
            stale,
            sessionCount: row._count.sessions,
            canGenerate: ctx.staffUser.role !== "TEACHER" && (!pending || stale),
          };
        });
    }),
});
