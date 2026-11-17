import * as Sentry from "@sentry/nextjs";
import { setErrorReporter } from "@lazuli/logging";
import { sentryOptions } from "@lazuli/logging/telemetry";

const options = sentryOptions({
  dsn: process.env.SENTRY_WEB_DSN,
  environment: process.env.LAZULI_ENV,
  verification: process.env.SENTRY_VERIFY,
  release: process.env.SENTRY_RELEASE,
});
Sentry.init({
  ...options,
  integrations: [
    Sentry.pinoIntegration({ error: { levels: [] }, log: { levels: ["warn", "error", "fatal"] } }),
  ],
});
if (options.enabled)
  setErrorReporter((error, tags) => {
    Sentry.captureException(error, { tags });
  });
