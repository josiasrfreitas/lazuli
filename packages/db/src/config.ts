const DEFAULT_POOL_MAX = 4;
const MAX_POOL_SIZE = 10;

export function getDatabasePoolMax(): number {
  const configured = process.env.LAZULI_DB_POOL_MAX;
  if (configured === undefined) return DEFAULT_POOL_MAX;
  const max = Number(configured);
  if (!Number.isInteger(max) || max < 1 || max > MAX_POOL_SIZE) {
    throw new Error("LAZULI_DB_POOL_MAX must be an integer between 1 and 10");
  }
  return max;
}

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
