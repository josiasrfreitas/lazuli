/** Returns the validated database connection string for server-side DB access. */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const deploymentEnvironment = process.env.LAZULI_ENV;
  if (deploymentEnvironment === "staging" || deploymentEnvironment === "prod") {
    const database = new URL(databaseUrl);
    if (
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      database.pathname !== `/lazuli_${deploymentEnvironment}`
    ) {
      throw new Error(`DATABASE_URL must point to lazuli_${deploymentEnvironment}.`);
    }
  }

  return databaseUrl;
}

/** Returns an environment suitable for Prisma child processes. */
export function getDatabaseProcessEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: getDatabaseUrl() };
}

/** Returns the optional full-workspace initialization completion key. */
export function getWorkspaceInitializationKey(): string | undefined {
  const key = process.env.LAZULI_WORKSPACE_INITIALIZATION_KEY;
  return key === undefined || key.length === 0 ? undefined : key;
}
