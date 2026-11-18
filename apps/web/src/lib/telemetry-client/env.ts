export function readBrowserTelemetry(): {
  dsn: string | undefined;
  environment: string | undefined;
  verification: string | undefined;
  release: string | undefined;
} {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    verification: process.env.NEXT_PUBLIC_SENTRY_VERIFY,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  };
}
