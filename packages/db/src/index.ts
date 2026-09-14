/**
 * Prisma schema, migrations, seeds, and raw-SQL constraint migrations (§2.1, §4).
 */

export { createDbClient, db, type DatabaseClient, type TransactionClient } from "./client.js";
export type { DB as KyselyDatabase } from "./generated/kysely/types.js";
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

/** Shared shape for domain entities under decision 0011. */
export type UUIDEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
