import { randomUUID } from "node:crypto";
import pino, { type DestinationStream, type Logger } from "pino";
import { configuredLogLevel, type LogLevel } from "./config.js";

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
    formatters: { level: (label: string) => ({ level: label.toUpperCase() }) },
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
  return options.destination === undefined
    ? pino(configuration)
    : pino(configuration, options.destination);
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
    const result = await action();
    logger.info(
      { checkpoint, duration_ms: Math.round(performance.now() - start), status: "ok" },
      `${checkpoint} completed`,
    );
    return result;
  } catch (error) {
    logger.error(
      {
        checkpoint,
        duration_ms: Math.round(performance.now() - start),
        status: "error",
        ...safeError(error),
      },
      `${checkpoint} failed`,
    );
    throw error;
  }
}
