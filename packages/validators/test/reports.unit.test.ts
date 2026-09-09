import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  artifactKindSchema,
  artifactStatusSchema,
  deriveArtifactStatus,
  getArtifactInputSchema,
  getArtifactOutputSchema,
  reportMonthSchema,
  reportRequestResultSchema,
  requestAttendanceSummaryInputSchema,
  requestClassRosterInputSchema,
  requestMonthlyAccountantCsvInputSchema,
  requestOverdueCsvInputSchema,
  requestStudentStatementInputSchema,
} from "../src/reports.js";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const CLASS_ID = "33333333-3333-4333-8333-333333333333";
const SEMESTER_ID = "44444444-4444-4444-8444-444444444444";
const REPORT_YEAR = 2026;
const JANUARY_REPORT_MONTH = 1;
const DECEMBER_REPORT_MONTH = 12;
const AFTER_DECEMBER_REPORT_MONTH = 13;

void describe("report enum input", () => {
  void it("accepts every generated artifact kind exposed by the reporting package", () => {
    assert.equal(artifactKindSchema.safeParse("STUDENT_STATEMENT_PDF").success, true);
    assert.equal(artifactKindSchema.safeParse("CLASS_ROSTER_PDF").success, true);
    assert.equal(artifactKindSchema.safeParse("ATTENDANCE_SUMMARY_PDF").success, true);
    assert.equal(artifactKindSchema.safeParse("OVERDUE_RECEIVABLES_CSV").success, true);
    assert.equal(artifactKindSchema.safeParse("MONTHLY_ACCOUNTANT_CSV").success, true);
    assert.equal(artifactKindSchema.safeParse("SIGNED_ORDER_PDF").success, true);
    assert.equal(artifactKindSchema.safeParse("UNKNOWN_REPORT").success, false);
  });

  void it("accepts only the four artifact polling statuses", () => {
    assert.equal(artifactStatusSchema.safeParse("queued").success, true);
    assert.equal(artifactStatusSchema.safeParse("running").success, true);
    assert.equal(artifactStatusSchema.safeParse("ready").success, true);
    assert.equal(artifactStatusSchema.safeParse("failed").success, true);
    assert.equal(artifactStatusSchema.safeParse("done").success, false);
  });
});

void describe("report request input", () => {
  void it("validates report request inputs before queueing artifacts", () => {
    const statement = requestStudentStatementInputSchema.parse({ studentId: STUDENT_ID });
    const roster = requestClassRosterInputSchema.parse({
      classId: CLASS_ID,
      semesterId: SEMESTER_ID,
    });
    const summary = requestAttendanceSummaryInputSchema.parse({
      studentId: STUDENT_ID,
      semesterId: SEMESTER_ID,
    });

    assert.equal(statement.studentId, STUDENT_ID);
    assert.equal(roster.semesterId, SEMESTER_ID);
    assert.equal(summary.studentId, STUDENT_ID);
    assert.equal(
      requestStudentStatementInputSchema.safeParse({ studentId: "not-a-uuid" }).success,
      false,
    );
    assert.equal(
      requestClassRosterInputSchema.safeParse({ classId: CLASS_ID, semesterId: "bad" }).success,
      false,
    );
  });

  void it("validates monthly accountant CSV bounds and empty overdue CSV input", () => {
    const monthly = requestMonthlyAccountantCsvInputSchema.parse({
      year: REPORT_YEAR,
      month: DECEMBER_REPORT_MONTH,
    });

    assert.equal(reportMonthSchema.safeParse(JANUARY_REPORT_MONTH).success, true);
    assert.equal(monthly.month, DECEMBER_REPORT_MONTH);
    assert.equal(reportMonthSchema.safeParse(0).success, false);
    assert.equal(reportMonthSchema.safeParse(AFTER_DECEMBER_REPORT_MONTH).success, false);
    assert.equal(requestOverdueCsvInputSchema.safeParse({}).success, true);
    assert.equal(
      requestOverdueCsvInputSchema.safeParse({ month: DECEMBER_REPORT_MONTH }).success,
      false,
    );
  });
});

void describe("report artifact schemas", () => {
  void it("validates queued job results and artifact lookup identifiers", () => {
    const result = reportRequestResultSchema.parse({
      artifactId: ARTIFACT_ID,
      jobId: "job-123",
    });
    const lookup = getArtifactInputSchema.parse({ id: ARTIFACT_ID });

    assert.equal(result.jobId, "job-123");
    assert.equal(lookup.id, ARTIFACT_ID);
    assert.equal(
      reportRequestResultSchema.safeParse({ artifactId: ARTIFACT_ID, jobId: "" }).success,
      false,
    );
    assert.equal(getArtifactInputSchema.safeParse({ id: "not-a-uuid" }).success, false);
  });

  void it("accepts the complete artifact polling output shape", () => {
    const requestedAt = new Date("2026-05-01T12:00:00.000Z");
    const parsed = getArtifactOutputSchema.parse({
      id: ARTIFACT_ID,
      kind: "STUDENT_STATEMENT_PDF",
      status: "queued",
      requestedById: null,
      studentId: STUDENT_ID,
      classId: null,
      orderId: null,
      storageBucket: null,
      storageObject: null,
      contentType: null,
      fileName: null,
      requestedAt,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      expiresAt: null,
    });

    assert.equal(parsed.studentId, STUDENT_ID);
    assert.equal(parsed.requestedAt.toISOString(), requestedAt.toISOString());
    assert.equal(
      getArtifactOutputSchema.safeParse({
        ...parsed,
        status: "done",
      }).success,
      false,
    );
  });
});

void describe("deriveArtifactStatus", () => {
  void it("returns queued when only requestedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({ startedAt: null, completedAt: null, failedAt: null }),
      "queued",
    );
  });

  void it("returns running when startedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: null,
        failedAt: null,
      }),
      "running",
    );
  });

  void it("returns ready when completedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: new Date(),
        failedAt: null,
      }),
      "ready",
    );
  });

  void it("returns failed when failedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: null,
        failedAt: new Date(),
      }),
      "failed",
    );
  });
});
