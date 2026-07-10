/**
 * Stable error codes stamped onto `GeneratedArtifact.errorCode` when
 * report generation fails (§4.8, §6.2). Messages carry IDs only — never
 * student/payer PII.
 */

export type ReportErrorCode =
  | "SETUP_ERROR_ARTIFACT_NOT_FOUND"
  | "SETUP_ERROR_MISSING_STUDENT_ID"
  | "SETUP_ERROR_MISSING_CLASS_ID"
  | "SETUP_ERROR_UNSUPPORTED_KIND"
  | "SETUP_ERROR_STUDENT_NOT_FOUND"
  | "SETUP_ERROR_CLASS_NOT_FOUND"
  | "SETUP_ERROR_NO_ACTIVE_SEMESTER"
  | "SETUP_ERROR_UNBUCKETED_SESSION";

export class ReportGenerationError extends Error {
  readonly code: ReportErrorCode;

  constructor(input: { code: ReportErrorCode; message: string }) {
    super(input.message);
    this.name = "ReportGenerationError";
    this.code = input.code;
  }
}
