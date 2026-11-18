import * as Sentry from "@sentry/nextjs";
import { setErrorReporter } from "@lazuli/logging";
import { sentryOptions } from "@lazuli/logging/telemetry";
import { readServerTelemetry } from "./lib/telemetry-server/env";

const options = sentryOptions(readServerTelemetry());
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
