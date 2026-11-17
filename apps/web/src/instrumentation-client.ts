import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@lazuli/logging/telemetry";

Sentry.init({
  ...sentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    verification: process.env.NEXT_PUBLIC_SENTRY_VERIFY,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  }),
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true, maskAllInputs: true }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
});
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
