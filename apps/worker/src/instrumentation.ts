import * as Sentry from "@sentry/node";
import { setErrorReporter } from "@lazuli/logging";
import { sentryOptions } from "@lazuli/logging/telemetry";

import { readWorkerTelemetry } from "./env.js";

const options = sentryOptions(readWorkerTelemetry());
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
export { flush } from "@sentry/node";
