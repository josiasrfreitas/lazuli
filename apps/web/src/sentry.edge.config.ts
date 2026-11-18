import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@lazuli/logging/telemetry";
import { readServerTelemetry } from "./lib/telemetry-server/env";

Sentry.init(sentryOptions(readServerTelemetry()));
