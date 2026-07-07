import { createCallerFactory, protectedProcedure, publicProcedure, router } from "./trpc/init.js";
import { attendanceRouter } from "./attendance/router.js";
import { calendarRouter } from "./calendar/router.js";
import { classesRouter } from "./classes/router.js";
import { enrollmentRouter } from "./enrollment/router.js";
import { financeRouter } from "./finance/router.js";
import { reportsRouter } from "./reports/router.js";
import { studentsRouter } from "./students/router.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  me: protectedProcedure.query(({ ctx }) => ctx.staffUser),
  students: studentsRouter,
  classes: classesRouter,
  calendar: calendarRouter,
  enrollment: enrollmentRouter,
  attendance: attendanceRouter,
  finance: financeRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory; used by integration tests and server contexts. */
export const createCaller = createCallerFactory(appRouter);
