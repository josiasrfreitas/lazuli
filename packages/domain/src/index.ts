/**
 * Pure domain calculators and invariants — no Prisma, no I/O.
 * Reused by tRPC procedures, workers, tests, and report builders (§3.2).
 */

export const DOMAIN_PACKAGE = "@lazuli/domain" as const;

export { resolveSemesterForDate, SemesterBucketError } from "./semester.js";
export type { SemesterBucketErrorCode, SemesterWindow } from "./semester.js";
export {
  generateRegularPortalClassName,
  type GenerateRegularPortalClassNameInput,
  type PortalClassNameSlot,
  type Weekday,
} from "./class-portal-name.js";
export { findNextStageInTrack, type StageInTrack } from "./stage-sequence.js";
export {
  brazilFederalHolidaysForYear,
  type BrazilFederalHoliday,
} from "./brazil-federal-holidays.js";
export {
  isSameDayInSaoPaulo,
  sessionEndInstant,
  saoPauloDateOnly,
  isAtLeastTomorrowInSaoPaulo,
} from "./session-time.js";
export { isSessionUntaken } from "./session-status.js";
export { deriveMakeupDisplayStatus, type MakeupDisplayStatus } from "./makeup-status.js";
export { computeAttendancePercent, type AttendancePercent } from "./attendance-percent.js";
export {
  deriveFirstDueDate,
  generateInstallments,
  InstallmentGenerationError,
  type DueDay,
  type GeneratedInstallment,
  type InstallmentGenerationErrorCode,
} from "./installment-generation.js";
