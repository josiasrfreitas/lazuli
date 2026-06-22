const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/** Prevents the development reset command from targeting a remote database. */
export function assertLocalDatabaseUrl(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const isLocalPostgres =
    POSTGRES_PROTOCOLS.has(url.protocol) && LOCAL_DATABASE_HOSTS.has(url.hostname);

  if (!isLocalPostgres) {
    throw new Error("db:reset is restricted to a local PostgreSQL database");
  }
}
