import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReportGenerationError } from "../src/reports/report-error.js";
import {
  currentSaoPauloYearMonth,
  resolveReportParameters,
  type ReportArtifactRow,
} from "../src/reports/report-parameters.js";

const ARTIFACT_ID = "00000000-0000-0000-0000-000000005301";
const STUDENT_ID = "00000000-0000-0000-0000-000000005302";
const CLASS_ID = "00000000-0000-0000-0000-000000005303";
const NOW = new Date("2026-07-09T15:00:00.000Z");
const JULY = 7;
const JUNE = 6;
const YEAR_2026 = 2026;

function artifact(overrides: Partial<ReportArtifactRow>): ReportArtifactRow {
  return {
    id: ARTIFACT_ID,
    kind: "OVERDUE_RECEIVABLES_CSV",
    studentId: null,
    classId: null,
    orderId: null,
    ...overrides,
  };
}

void describe("resolveReportParameters", () => {
  void it("resolves student-scoped PDF kinds", () => {
    for (const kind of ["STUDENT_STATEMENT_PDF", "ATTENDANCE_SUMMARY_PDF"]) {
      const parameters = resolveReportParameters({
        artifact: artifact({ kind, studentId: STUDENT_ID }),
        now: NOW,
      });

      assert.deepEqual(parameters, { kind, studentId: STUDENT_ID });
    }
  });

  void it("fails student-scoped kinds without a studentId", () => {
    assert.throws(
      () =>
        resolveReportParameters({
          artifact: artifact({ kind: "STUDENT_STATEMENT_PDF" }),
          now: NOW,
        }),
      (error: unknown) =>
        error instanceof ReportGenerationError && error.code === "SETUP_ERROR_MISSING_STUDENT_ID",
    );
  });

  void it("resolves the class roster kind and fails without a classId", () => {
    const parameters = resolveReportParameters({
      artifact: artifact({ kind: "CLASS_ROSTER_PDF", classId: CLASS_ID }),
      now: NOW,
    });

    assert.deepEqual(parameters, { kind: "CLASS_ROSTER_PDF", classId: CLASS_ID });
    assert.throws(
      () => resolveReportParameters({ artifact: artifact({ kind: "CLASS_ROSTER_PDF" }), now: NOW }),
      (error: unknown) =>
        error instanceof ReportGenerationError && error.code === "SETUP_ERROR_MISSING_CLASS_ID",
    );
  });
});

void describe("resolveReportParameters period defaulting", () => {
  void it("defaults the accountant CSV to the current America/Sao_Paulo month", () => {
    const parameters = resolveReportParameters({
      artifact: artifact({ kind: "MONTHLY_ACCOUNTANT_CSV" }),
      now: NOW,
    });

    assert.deepEqual(parameters, {
      kind: "MONTHLY_ACCOUNTANT_CSV",
      year: YEAR_2026,
      month: JULY,
    });
  });

  void it("rejects SIGNED_ORDER_PDF as an unsupported generated kind", () => {
    assert.throws(
      () => resolveReportParameters({ artifact: artifact({ kind: "SIGNED_ORDER_PDF" }), now: NOW }),
      (error: unknown) =>
        error instanceof ReportGenerationError && error.code === "SETUP_ERROR_UNSUPPORTED_KIND",
    );
  });
});

void describe("currentSaoPauloYearMonth", () => {
  void it("uses the São Paulo wall clock, not UTC", () => {
    // 02:30Z on July 1st is still June 30th in São Paulo (UTC-3).
    assert.deepEqual(currentSaoPauloYearMonth(new Date("2026-07-01T02:30:00.000Z")), {
      year: YEAR_2026,
      month: JUNE,
    });
  });
});
