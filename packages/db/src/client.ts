import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";
import { getDatabaseUrl } from "./config.js";
import { softDeleteExtension } from "./soft-delete.js";

/** Creates a PostgreSQL-backed Prisma client. Prefer the exported singleton. */
export function createDbClient(databaseUrl = getDatabaseUrl()): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const client = new PrismaClient({ adapter });

  // The foundation schema intentionally has no models, so Prisma types model
  // query extensions as `never` until the first owning issue adds a model.
  return client.$extends(softDeleteExtension as never) as PrismaClient;
}

type DatabaseClient = ReturnType<typeof createDbClient>;
const globalDatabase = globalThis as typeof globalThis & {
  lazuliDatabase?: DatabaseClient;
};

export const db = globalDatabase.lazuliDatabase ?? createDbClient();
globalDatabase.lazuliDatabase = db;
