import { studentAttendanceRouter } from "./student-attendance/router.js";
import { classRecordsRouter } from "./class-records/router.js";
import { planningRouter } from "./stage-planning/router.js";
import { teachingProgramsRouter } from "./teaching-programs/router.js";
import { teacherWorkspaceRouter } from "./teacher-workspace/router.js";
import { assessmentFilesRouter } from "./assessment-files/router.js";
import { commandSearchRouter } from "./command-search/router.js";
import { semesterOrganizationRouter } from "./semester-organization/router.js";
import { createCallerFactory, protectedProcedure, publicProcedure, router } from "./trpc/init.js";
import { appointmentsRouter } from "./appointments/router.js";
import { sessionGenerationRouter } from "./session-generation/router.js";
import { assessmentsRouter } from "./assessments/router.js";
import { activityRouter } from "./activity/router.js";
import { attendanceRouter } from "./attendance/router.js";
import { calendarRouter } from "./calendar/router.js";
import { admissionsRouter } from "./admissions/router.js";
import { teachersRouter } from "./teachers/router.js";
import { classesRouter } from "./classes/router.js";
import { dashboardRouter } from "./dashboard/router.js";
import { enrollmentRouter } from "./enrollment/router.js";
import { financeRouter } from "./finance/router.js";
import { reportsRouter } from "./reports/router.js";
import { studentsRouter } from "./students/router.js";

import { occurrencesRouter, interventionsRouter } from "./occurrences/router.js";

export const appRouter = router({
  studentAttendance: studentAttendanceRouter,
  classRecords: classRecordsRouter,
  planning: planningRouter,
  teacherWorkspace: teacherWorkspaceRouter,
  assessmentFiles: assessmentFilesRouter,
  teachingPrograms: teachingProgramsRouter,
  commandSearch: commandSearchRouter,
  semesterOrganization: semesterOrganizationRouter,
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  me: protectedProcedure.query(({ ctx }) => ctx.staffUser),
  students: studentsRouter,
  classes: classesRouter,
  teachers: teachersRouter,
  admissions: admissionsRouter,
  calendar: calendarRouter,
  enrollment: enrollmentRouter,
  attendance: attendanceRouter,
  appointments: appointmentsRouter,
  sessionGeneration: sessionGenerationRouter,
  assessments: assessmentsRouter,
  occurrences: occurrencesRouter,
  interventions: interventionsRouter,
  activity: activityRouter,
  finance: financeRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory; used by integration tests and server contexts. */
export const createCaller = createCallerFactory(appRouter);
