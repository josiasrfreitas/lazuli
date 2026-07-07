/**
 * Prisma schema, migrations, seeds, and raw-SQL constraint migrations (§2.1, §4).
 */

export { createDbClient, db } from "./client.js";
export { Prisma } from "./generated/prisma/client.js";
export { COURSE_CATALOG, seedCourseCatalog } from "./seed-course-catalog.js";
export type {
  Address,
  Enrollment,
  FinanceSettings,
  GeneratedArtifact,
  Guardian,
  Installment,
  InstallmentAdjustment,
  Order,
  OrderBeneficiary,
  Payer,
  PaymentAllocation,
  PaymentEntry,
  PedagogicalProgress,
  ProductLine,
  SchoolClosedDay,
  Semester,
  Stage,
  Student,
  Track,
} from "./generated/prisma/client.js";
export {
  ArtifactKind,
  InstallmentAdjustmentType,
  OrderKind,
  PaymentMethod,
} from "./generated/prisma/enums.js";
export { getDatabaseUrl } from "./config.js";

/** Shared shape for all domain entities (TECHNICAL_SPEC §4.0). */
export type UUIDEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
