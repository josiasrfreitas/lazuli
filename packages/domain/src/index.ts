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
