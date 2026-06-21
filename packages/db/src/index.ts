/**
 * Prisma schema, migrations, seeds, and raw-SQL constraint migrations (§2.1, §4).
 * Prisma client + UUIDEntity soft-delete extension are wired in issue P00-03.
 */

/** Shared shape for all domain entities (TECHNICAL_SPEC §4.0). */
export type UUIDEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
