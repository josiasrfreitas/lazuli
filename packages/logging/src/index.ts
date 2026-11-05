import { randomUUID } from "node:crypto";
import pino, { type DestinationStream, type Logger } from "pino";
import {
  configuredLogLevel,
  isDevelopment,
  useDevelopmentColor,
  useJsonLogFormat,
  type LogLevel,
} from "./config.js";
import { formatDevelopmentLine } from "./development-format.js";

type ServiceName = "web" | "worker";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const errorCodePattern = /^[A-Z][A-Z0-9_]{0,63}$/u;

/** The proxy owns HTTP IDs; this fallback also covers callers outside Next requests. */
export function requestIdFromHeaders(headers: Pick<Headers, "get">): string {
  const value = headers.get("x-request-id");
  return value !== null && requestIdPattern.test(value) ? value : randomUUID();
}

export function createServiceLogger(
  serviceName: ServiceName,
  options: { destination?: DestinationStream; level?: LogLevel } = {},
): Logger {
  const level = options.level ?? configuredLogLevel();
  const configuration = {
    base: { service_name: serviceName },
    level,
    messageKey: "message",
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
      log: (value: Record<string, string | number | boolean | null | undefined | object>) => {
        if (typeof value.error_stack !== "string") return value;
        const { error_stack, ...fields } = value;
        return { ...fields, exception: error_stack };
      },
    },
    // Callers pass only allowlisted fields. Redaction is a second line of defense.
    redact: {
      paths: [
        "password",
        "token",
        "authorization",
        "cookie",
        "input",
        "headers",
        "req.headers",
        "*.password",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
  };
  if (options.destination !== undefined) return pino(configuration, options.destination);
  if (isDevelopment() && !useJsonLogFormat()) return pino(configuration, developmentDestination);
  return pino(configuration);
}

const developmentDestination: DestinationStream = {
  write(line: string): void {
    try {
      process.stdout.write(
        formatDevelopmentLine(line, useDevelopmentColor(Boolean(process.stdout.isTTY))),
      );
    } catch {
      process.stdout.write("[logging] Failed to format a log line.\n");
    }
  },
};

/** Log only reviewed, non-identifying facts from real process steps in local development. */
export function logDevelopmentProcess(
  logger: Logger,
  event: {
    requestId?: string | undefined;
    userId?: string | undefined;
    resource: string;
    operation: "GET" | "POST" | "DELETE" | "DB" | "API";
    step: string;
    durationMs?: number | undefined;
    facts?: Record<string, number | boolean> | undefined;
  },
): void {
  if (!isDevelopment()) return;
  logger.info(
    {
      request_id: event.requestId,
      user_id: event.userId,
      resource: event.resource,
      operation: event.operation,
      process_step: event.step,
      duration_ms: event.durationMs,
      facts: event.facts,
    },
    event.step,
  );
}

/** Keep call frames for server diagnosis without recording error messages or query values. */
// eslint-disable-next-line @typescript-eslint/no-restricted-types -- JavaScript can throw any value.
export function safeError(error: unknown): {
  error_name: string;
  error_code?: string;
  error_stack?: string;
} {
  if (!(error instanceof Error)) return { error_name: "UnknownError" };
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const stack = error.stack
    ?.split("\n")
    .filter((line) => /^\s+at\s/u.test(line))
    .join("\n");
  return {
    error_name: /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(error.name) ? error.name : "Error",
    ...(code !== undefined && errorCodePattern.test(code) ? { error_code: code } : {}),
    ...(stack ? { error_stack: stack } : {}),
  };
}

export async function withCheckpoint<Result>(
  logger: Logger,
  options: { checkpoint: string; action: () => Promise<Result> },
): Promise<Result> {
  const { checkpoint, action } = options;
  const start = performance.now();
  try {
    return await action();
  } catch (error) {
    logger.error(
      {
        checkpoint,
        duration_ms: Math.round(performance.now() - start),
        status: "error",
        ...safeError(error),
      },
      "Failed to load data for operation",
    );
    throw error;
  }
}
