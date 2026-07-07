import type { ArtifactKind } from "@lazuli/validators";
import {
  getArtifactInputSchema,
  requestAttendanceSummaryInputSchema,
  requestClassRosterInputSchema,
  requestMonthlyAccountantCsvInputSchema,
  requestOverdueCsvInputSchema,
  requestStudentStatementInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router, staffProcedure } from "../trpc/init.js";
import { getArtifact, assertClassRosterScope } from "./get-artifact.js";
import { requestReportArtifact, resolveReportGenerateQueue } from "./request-artifact.js";

export const reportsRouter = router({
  requestStudentStatement: adminProcedure
    .input(requestStudentStatementInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        requestReportArtifact({
          database,
          reportGenerateQueue: resolveReportGenerateQueue(ctx.reportGenerateQueue),
          staffUser: ctx.staffUser,
          kind: "STUDENT_STATEMENT_PDF" satisfies ArtifactKind,
          studentId: input.studentId,
          ...optionalNow(ctx.now),
        }),
      ),
    ),
  requestClassRoster: staffProcedure
    .input(requestClassRosterInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (database) => {
        await assertClassRosterScope({
          database,
          staffUser: ctx.staffUser,
          classId: input.classId,
        });

        return requestReportArtifact({
          database,
          reportGenerateQueue: resolveReportGenerateQueue(ctx.reportGenerateQueue),
          staffUser: ctx.staffUser,
          kind: "CLASS_ROSTER_PDF" satisfies ArtifactKind,
          classId: input.classId,
          ...optionalNow(ctx.now),
        });
      }),
    ),
  requestAttendanceSummary: adminProcedure
    .input(requestAttendanceSummaryInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        requestReportArtifact({
          database,
          reportGenerateQueue: resolveReportGenerateQueue(ctx.reportGenerateQueue),
          staffUser: ctx.staffUser,
          kind: "ATTENDANCE_SUMMARY_PDF" satisfies ArtifactKind,
          studentId: input.studentId,
          ...optionalNow(ctx.now),
        }),
      ),
    ),
  requestOverdueCsv: adminProcedure.input(requestOverdueCsvInputSchema).mutation(({ ctx }) =>
    ctx.db.$transaction((database) =>
      requestReportArtifact({
        database,
        reportGenerateQueue: resolveReportGenerateQueue(ctx.reportGenerateQueue),
        staffUser: ctx.staffUser,
        kind: "OVERDUE_RECEIVABLES_CSV" satisfies ArtifactKind,
        ...optionalNow(ctx.now),
      }),
    ),
  ),
  requestMonthlyAccountantCsv: adminProcedure
    .input(requestMonthlyAccountantCsvInputSchema)
    .mutation(({ ctx, input }) => {
      void input;
      return ctx.db.$transaction((database) =>
        requestReportArtifact({
          database,
          reportGenerateQueue: resolveReportGenerateQueue(ctx.reportGenerateQueue),
          staffUser: ctx.staffUser,
          kind: "MONTHLY_ACCOUNTANT_CSV" satisfies ArtifactKind,
          ...optionalNow(ctx.now),
        }),
      );
    }),
  getArtifact: staffProcedure.input(getArtifactInputSchema).query(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      getArtifact({
        database,
        staffUser: ctx.staffUser,
        id: input.id,
      }),
    ),
  ),
});

function optionalNow(now: Date | undefined): { now?: Date } {
  return now === undefined ? {} : { now };
}
