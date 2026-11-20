type SentryEnvironment = {
  dsn: string | undefined;
  environment: string | undefined;
  verification: string | undefined;
  release: string | undefined;
};

export function readServerTelemetry(): SentryEnvironment {
  return {
    dsn: process.env.SENTRY_WEB_DSN,
    environment: process.env.LAZULI_ENV,
    verification: process.env.SENTRY_VERIFY,
    release: process.env.SENTRY_RELEASE,
  };
}

// Keep the Next runtime check next to each dynamic import for bundler pruning.
export async function registerRuntimeTelemetry(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../../sentry.edge.config");
}
