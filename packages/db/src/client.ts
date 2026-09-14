import { PrismaPg } from "@prisma/adapter-pg";
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import kyselyExtension from "prisma-extension-kysely";

import { Prisma, PrismaClient } from "./generated/prisma/client.js";
import type { DB } from "./generated/kysely/types.js";
import { getDatabaseUrl } from "./config.js";
import { softDeleteExtension } from "./soft-delete.js";

/** Creates a PostgreSQL-backed Prisma client. Prefer the exported singleton. */
type KyselyCapability = { readonly $kysely: Kysely<DB> };

export type TransactionClient = Prisma.TransactionClient & KyselyCapability;

export type DatabaseClient = Omit<PrismaClient, "$transaction"> &
  KyselyCapability & {
    $transaction<Result>(
      operation: (transaction: TransactionClient) => Promise<Result>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ): Promise<Result>;
  } & Pick<PrismaClient, "$transaction">;

export function createDbClient(databaseUrl = getDatabaseUrl()): DatabaseClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const client = new PrismaClient({ adapter });

  const extendedClient = client.$extends(softDeleteExtension as never).$extends(
    kyselyExtension<DB>({
      kysely: (driver) =>
        new Kysely<DB>({
          dialect: {
            createAdapter: () => new PostgresAdapter(),
            createDriver: () => driver,
            createIntrospector: (database) => new PostgresIntrospector(database),
            createQueryCompiler: () => new PostgresQueryCompiler(),
          },
        }),
    }),
  );

  return extendedClient as object as DatabaseClient;
}

const globalDatabase = globalThis as typeof globalThis & {
  lazuliDatabase?: DatabaseClient;
};

export const db = globalDatabase.lazuliDatabase ?? createDbClient();
globalDatabase.lazuliDatabase = db;
