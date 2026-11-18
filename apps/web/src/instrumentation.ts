import * as Sentry from "@sentry/nextjs";

export { registerRuntimeTelemetry as register } from "./lib/telemetry-server/env";
export const onRequestError = Sentry.captureRequestError;
