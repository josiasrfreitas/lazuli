/** Returns the validated database connection string for server-side DB access. */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

/** Returns an environment suitable for Prisma child processes. */
export function getDatabaseProcessEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: getDatabaseUrl() };
}
