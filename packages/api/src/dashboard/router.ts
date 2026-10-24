import { z } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { canAccess } from "../trpc/rbac.js";
import { HOME_GROUPS, HOME_GROUP_INFO } from "./home-model.js";
import { readHomePending } from "./home-pending.js";
import { readAdminHome, readHomeBusiness } from "./home.js";
import { adminProcedure, router, teacherProcedure } from "../trpc/init.js";
import { readAdminDashboardMetrics, readTeacherHome } from "./data.js";

const MAX_HOME_PAGE = 100_000;
const homePeriodInput = z
  .object({
    month: z
      .string()
      .regex(/^20\d{2}-(0[1-9]|1[0-2])$/u)
      .optional(),
  })
  .optional();

export const dashboardRouter = router({
  home: adminProcedure.input(homePeriodInput).query(({ ctx, input }) =>
    readAdminHome({
      database: ctx.db,
      now: ctx.now ?? new Date(),
      staffUser: ctx.staffUser,
      ...(input?.month ? { month: input.month } : {}),
    }),
  ),
  pending: adminProcedure
    .input(
      z.object({
        kind: z.enum(HOME_GROUPS),
        page: z.number().int().min(1).max(MAX_HOME_PAGE).default(1),
        period: z.enum(["all", "recent", "history"]).default("all"),
      }),
    )
    .query(({ ctx, input }) => {
      if (
        HOME_GROUP_INFO[input.kind].area === "finance" &&
        !canAccess(ctx.staffUser.role, "finance")
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      return readHomePending(ctx.db, { ...input, now: ctx.now ?? new Date() });
    }),
  business: adminProcedure.input(homePeriodInput).query(({ ctx, input }) => {
    if (!canAccess(ctx.staffUser.role, "finance")) throw new TRPCError({ code: "FORBIDDEN" });
    return readHomeBusiness({
      database: ctx.db,
      now: ctx.now ?? new Date(),
      requestedMonth: input?.month,
    });
  }),
  adminMetrics: adminProcedure.query(({ ctx }) =>
    readAdminDashboardMetrics({ database: ctx.db, now: ctx.now ?? new Date() }),
  ),
  teacherHome: teacherProcedure.query(({ ctx }) =>
    readTeacherHome({
      database: ctx.db,
      staffUser: ctx.staffUser,
      now: ctx.now ?? new Date(),
    }),
  ),
});
