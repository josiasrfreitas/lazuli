/**
 * Prisma schema, migrations, seeds, and raw-SQL constraint migrations (§2.1, §4).
 */

export { createDbClient, db } from "./client.js";
export { getDatabaseUrl } from "./config.js";

/** Shared shape for all domain entities (TECHNICAL_SPEC §4.0). */
export type UUIDEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
