const levels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
export type LogLevel = (typeof levels)[number];

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function useJsonLogFormat(): boolean {
  return process.env.LOG_FORMAT === "json";
}

export function useDevelopmentColor(isTTY: boolean): boolean {
  return !process.env.NO_COLOR && (isTTY || process.env.FORCE_COLOR === "1");
}

/** Validate the process setting once when a service logger is created. */
export function configuredLogLevel(): LogLevel {
  const requested = process.env.LOG_LEVEL;
  if (requested !== undefined && requested !== "") {
    if (!levels.some((level) => level === requested)) throw new Error("Invalid LOG_LEVEL");
    return requested as LogLevel;
  }
  if (process.env.NODE_ENV === "test") return "silent";
  if (process.env.NODE_ENV === "development") return "debug";
  return "info";
}
