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

  return isolateTransactionQueries(extendedClient as object as DatabaseClient);
}

const globalDatabase = globalThis as typeof globalThis & {
  lazuliDatabase?: DatabaseClient;
};

export const db = globalDatabase.lazuliDatabase ?? createDbClient();
globalDatabase.lazuliDatabase = db;

/** Pin Kysely before another callback overwrites the extension's shared client property. */
function isolateTransactionQueries(client: DatabaseClient): DatabaseClient {
  const transaction = client.$transaction.bind(client);
  return new Proxy(client, {
    get(target, property): DatabaseClient[keyof DatabaseClient] {
      if (property !== "$transaction")
        return Reflect.get(target, property) as DatabaseClient[keyof DatabaseClient];
      return (<Result>(
        operation:
          | ((database: TransactionClient) => Promise<Result>)
          | Prisma.PrismaPromise<Result>[],
        options?: {
          maxWait?: number;
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        },
      ): Promise<Result | Result[]> => {
        if (Array.isArray(operation)) return transaction(operation, options);
        return transaction((database) => {
          const kysely = database.$kysely;
          const isolated = new Proxy(database, {
            get(
              transactionTarget,
              transactionProperty,
            ): TransactionClient[keyof TransactionClient] {
              return transactionProperty === "$kysely"
                ? kysely
                : (Reflect.get(
                    transactionTarget,
                    transactionProperty,
                  ) as TransactionClient[keyof TransactionClient]);
            },
          });
          return operation(isolated);
        }, options);
      }) as DatabaseClient["$transaction"];
    },
  });
}
