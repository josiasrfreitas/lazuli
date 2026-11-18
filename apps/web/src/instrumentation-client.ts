import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@lazuli/logging/telemetry";
import { readBrowserTelemetry } from "./lib/telemetry-client/env";

Sentry.init({
  ...sentryOptions(readBrowserTelemetry()),
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true, maskAllInputs: true }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
});
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
