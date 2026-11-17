import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@lazuli/logging/telemetry";

Sentry.init(
  sentryOptions({
    dsn: process.env.SENTRY_WEB_DSN,
    environment: process.env.LAZULI_ENV,
    verification: process.env.SENTRY_VERIFY,
    release: process.env.SENTRY_RELEASE,
  }),
);
