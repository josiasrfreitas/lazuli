import { adminProcedure, router, teacherProcedure } from "../trpc/init.js";
import { readAdminDashboardMetrics, readTeacherHome } from "./data.js";

export const dashboardRouter = router({
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
