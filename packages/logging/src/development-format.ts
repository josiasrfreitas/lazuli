const ANSI = {
  reset: "\u001B[0m",
  gray: "\u001B[90m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  cyan: "\u001B[36m",
} as const;
const CLOCK_START = 11;
const CLOCK_END = 19;
const LEVEL_WIDTH = 5;

type LogValue = string | number | boolean | null | LogValue[] | { [key: string]: LogValue };
type LogEntry = Record<string, LogValue>;

function paint(value: string, options: { color: keyof typeof ANSI; enabled: boolean }): string {
  return options.enabled ? `${ANSI[options.color]}${value}${ANSI.reset}` : value;
}

function stringField(entry: LogEntry, key: string): string | null {
  const value = entry[key];
  return typeof value === "string" ? value : null;
}

function operation(entry: LogEntry): string | null {
  const explicit = stringField(entry, "operation");
  if (explicit) return explicit;
  const type = stringField(entry, "procedure_type");
  if (type === "query") return "GET";
  if (type === "mutation") return "POST";
  return null;
}

function subject(entry: LogEntry): string {
  const resource = stringField(entry, "resource") ?? stringField(entry, "procedure");
  if (resource) {
    const action = operation(entry);
    return `${action ? `${action} ` : ""}${resource}`;
  }
  return stringField(entry, "checkpoint") ?? stringField(entry, "service_name") ?? "app";
}

function levelColor(level: string): keyof typeof ANSI {
  if (level === "ERROR" || level === "FATAL") return "red";
  if (level === "WARN") return "yellow";
  return "green";
}

function heading(entry: LogEntry, useColor: boolean): string {
  const time = stringField(entry, "timestamp")?.slice(CLOCK_START, CLOCK_END) ?? "--:--:--";
  const level = stringField(entry, "level") ?? "INFO";
  const requestId = stringField(entry, "request_id")?.split("-", 1)[0] ?? "no request";
  const message =
    stringField(entry, "process_step") ?? stringField(entry, "message") ?? "Event recorded";
  return `${paint(`[${time}]`, { color: "gray", enabled: useColor })} ${paint(level.padEnd(LEVEL_WIDTH), { color: levelColor(level), enabled: useColor })} ${paint(`[${requestId}]`, { color: "cyan", enabled: useColor })} ${paint(subject(entry), { color: "gray", enabled: useColor })} · ${message}`;
}

function statusDetail(value: LogValue | undefined): string | null {
  if (typeof value !== "string") return null;
  if (value === "ok") return "status=success";
  if (value === "error") return "status=failure";
  return `status=${value}`;
}

function fact(value: LogValue): string | null {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function factDetails(value: LogValue | undefined): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([name, item]) => {
    const safe = fact(item);
    return safe === null ? [] : [`${name}=${safe}`];
  });
}

function details(entry: LogEntry): string[] {
  const duration = entry.duration_ms;
  const user = stringField(entry, "user_id") ?? stringField(entry, "staff_user_id");
  const error = stringField(entry, "error_code");
  const cause = stringField(entry, "error_cause_code");
  const type = stringField(entry, "error_cause_name");
  return [
    ...(typeof duration === "number" ? [`${duration}ms`] : []),
    statusDetail(entry.status),
    ...(user ? [`user=${user}`] : []),
    ...(error ? [`error=${error}`] : []),
    ...(cause ? [`cause=${cause}`] : []),
    ...(type ? [`type=${type}`] : []),
    ...factDetails(entry.facts),
  ].filter((item): item is string => item !== null);
}

function exceptionLines(entry: LogEntry, useColor: boolean): string {
  const exception = stringField(entry, "exception");
  const level = stringField(entry, "level");
  if (!exception || (level !== "ERROR" && level !== "FATAL")) return "";
  return `${exception
    .split("\n")
    .map((frame) => paint(`  ${frame}`, { color: "red", enabled: useColor }))
    .join("\n")}\n`;
}

/** A readable terminal view over the same safe, structured event stored as JSON in cloud logs. */
export function formatDevelopmentLine(line: string, useColor: boolean): string {
  const entry = JSON.parse(line) as LogEntry;
  const fields = details(entry);
  const suffix = fields.length > 0 ? ` · ${fields.join(" · ")}` : "";
  return `${heading(entry, useColor)}${suffix}\n${exceptionLines(entry, useColor)}`;
}
