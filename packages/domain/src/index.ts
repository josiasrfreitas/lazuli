/**
 * Pure domain calculators and invariants — no Prisma, no I/O.
 * Reused by tRPC procedures, workers, tests, and report builders (§3.2).
 */

export const DOMAIN_PACKAGE = "@lazuli/domain" as const;

export { resolveSemesterForDate, SemesterBucketError } from "./semester.js";
export type { SemesterBucketErrorCode, SemesterWindow } from "./semester.js";
export {
  generateRegularPortalClassName,
  generatePersonalizedPortalClassName,
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
  type SaoPauloMonthDateOnlyUtcBounds,
  saoPauloMidnightToInstant,
  saoPauloMonthDateOnlyUtcBounds,
  type SaoPauloMonthInstantBounds,
  saoPauloMonthInstantBounds,
  isAtLeastTomorrowInSaoPaulo,
} from "./session-time.js";
export { intersectEnrollmentSemesterWindows } from "./window-intersection.js";
export type { EnrollmentDateWindow, SemesterDateWindow } from "./window-intersection.js";
export { isSessionUntaken } from "./session-status.js";
export { deriveMakeupDisplayStatus, type MakeupDisplayStatus } from "./makeup-status.js";
export { computeAttendancePercent, type AttendancePercent } from "./attendance-percent.js";
export {
  deriveFirstDueDate,
  FINANCE_DUE_DAY_FIFTEENTH,
  FINANCE_DUE_DAY_FIFTH,
  FINANCE_DUE_DAY_TENTH,
  FINANCE_DUE_DAY_TWENTIETH,
  FINANCE_DUE_DAY_TWENTY_FIFTH,
  FINANCE_DUE_DAYS,
  generateInstallments,
  InstallmentGenerationError,
  type DueDay,
  type GeneratedInstallment,
  type InstallmentGenerationErrorCode,
} from "./installment-generation.js";
export {
  deriveInstallmentLedger,
  deriveOrderLedger,
  derivePaymentEntryRemainder,
  type DeriveInstallmentLedgerInput,
  type DeriveOrderLedgerInput,
  type DerivePaymentEntryRemainderInput,
  type InstallmentDisplayStatus,
  type InstallmentLedger,
  type OrderDisplayStatus,
  type OrderLedger,
  type OverdueAgeBucket,
  type PaymentEntryRemainder,
} from "./finance-ledger.js";
export {
  buildReceivablesSnapshot,
  isDueInSaoPauloMonth,
  type ReceivablesAgeBuckets,
  type ReceivablesSnapshot,
  type ReceivablesSnapshotInstallment,
} from "./receivables-dashboard.js";
export { toWhatsAppUrl } from "./whatsapp-url.js";
export {
  addCalendarMonths,
  previewMonthlyContract,
  priceAfterDiscountCents,
  punctualityDiscountOnPayment,
} from "./monthly-contract.js";
export type { MonthlyContractTerms } from "./monthly-contract.js";

export {
  deriveContractFinancialSummary,
  deriveContractServiceStatus,
  type ContractFinancialStatus,
  type ContractFinancialSummary,
  type ContractServiceStatus,
} from "./contract-status.js";
export {
  quoteSettlement,
  type SettlementInput,
  type SettlementQuote,
} from "./payment-settlement.js";
export { CLASS_REFERENCE_CAPACITY, classOccupancyLevel } from "./class-occupancy.js";
export {
  weekDates,
  weekdayOf,
  effectiveTeacherId,
  intervalsOverlap,
  responsibleTeacherId,
  teachingMinutes,
  teacherWeekMinutes,
  type TeacherCommitment,
  type TeacherWeekday,
} from "./teacher-schedule.js";

export {
  studentFinanceSummary,
  type StudentFinanceSummary,
  type StudentFinanceDebtState,
  type StudentFinancePaymentState,
} from "./student-finance.js";

export { planningBand } from "./planning-band.js";

export * from "./student-attendance.js";
export {
  availabilityCovers,
  availabilityIsCurrent,
  type AvailabilityWindow,
} from "./admission-availability.js";
export {
  ACADEMIC_COMPETENCES,
  ACADEMIC_PASS_SCORE,
  ACADEMIC_MAX_SCORE,
  assessmentResults,
  assessmentStatus,
  type AcademicCompetence,
  type AssessmentPhase,
  type AcademicGrade,
  type CompetenceResult,
} from "./assessment.js";
export {
  normalizeAttendanceName,
  matchAttendanceNames,
  attendanceDistance,
  type AttendanceNameCandidate,
  type AttendancePoint,
} from "./student-attendance.js";
export * from "./compensated-attendance.js";
export * from "./semester-organization.js";
export { type StudentSettlement } from "./student-finance.js";

export { normalizeSearch } from "./search.js";

export * from "./contract-termination.js";
export { INITIAL_MATERIAL_PRICING, materialPriceQuote } from "./material-pricing.js";
export { materialReminderState, stageMaterialAttention } from "./material-reminder.js";
export {
  TEACHING_HOUR_MINUTES,
  DEFAULT_TEACHING_MODALITY,
  assertTeachingProgram,
  type TrackAgeGroup,
  type ProgramActivityKind,
  type TeachingProgramImport,
} from "./teaching-program.js";
export { studentPendingActions, type PendingAction } from "./pending-actions.js";

export { extractIdentityDocument } from "./identity-extraction/extract.js";
export type {
  IdentityOcrLine,
  IdentityExtraction,
  ExtractedIdentityField,
  FieldCandidate,
  DocumentFamily,
} from "./identity-extraction/types.js";
