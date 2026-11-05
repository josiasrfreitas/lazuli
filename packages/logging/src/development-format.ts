const ANSI = {
  reset: "\u001b[0m",
  gray: "\u001b[90m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  cyan: "\u001b[36m",
} as const;

function paint(value: string, color: keyof typeof ANSI, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${value}${ANSI.reset}` : value;
}

function fact(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

/** A readable terminal view over the same safe, structured event stored as JSON in cloud logs. */
export function formatDevelopmentLine(line: string, useColor: boolean): string {
  const entry = JSON.parse(line) as Record<string, unknown>;
  const time = typeof entry.timestamp === "string" ? entry.timestamp.slice(11, 19) : "--:--:--";
  const level = typeof entry.level === "string" ? entry.level : "INFO";
  const levelColor =
    level === "ERROR" || level === "FATAL" ? "red" : level === "WARN" ? "yellow" : "green";
  const requestId =
    typeof entry.request_id === "string" ? entry.request_id.split("-", 1)[0] : "no request";
  const resource = typeof entry.resource === "string" ? entry.resource : entry.procedure;
  const operation =
    typeof entry.operation === "string"
      ? entry.operation
      : entry.procedure_type === "query"
        ? "GET"
        : entry.procedure_type === "mutation"
          ? "POST"
          : null;
  const step = typeof entry.process_step === "string" ? entry.process_step : null;
  const message = step ?? (typeof entry.message === "string" ? entry.message : "Event recorded");
  const subject =
    typeof resource === "string"
      ? `${operation ? `${operation} ` : ""}${resource}`
      : typeof entry.checkpoint === "string"
        ? entry.checkpoint
        : String(entry.service_name ?? "app");
  const details: string[] = [];
  if (typeof entry.duration_ms === "number") details.push(`${entry.duration_ms}ms`);
  if (typeof entry.status === "string")
    details.push(
      `status=${entry.status === "ok" ? "success" : entry.status === "error" ? "failure" : entry.status}`,
    );
  if (typeof entry.user_id === "string") details.push(`user=${entry.user_id}`);
  else if (typeof entry.staff_user_id === "string") details.push(`user=${entry.staff_user_id}`);
  if (typeof entry.error_code === "string") details.push(`error=${entry.error_code}`);
  if (typeof entry.error_cause_code === "string") details.push(`cause=${entry.error_cause_code}`);
  if (typeof entry.error_cause_name === "string") details.push(`type=${entry.error_cause_name}`);
  if (entry.facts && typeof entry.facts === "object" && !Array.isArray(entry.facts)) {
    for (const [name, value] of Object.entries(entry.facts)) {
      const safe = fact(value);
      if (safe !== null) details.push(`${name}=${safe}`);
    }
  }
  const heading = `${paint(`[${time}]`, "gray", useColor)} ${paint(level.padEnd(5), levelColor, useColor)} ${paint(`[${requestId}]`, "cyan", useColor)} ${paint(subject, "gray", useColor)} · ${message}`;
  const summary = `${heading}${details.length ? ` · ${details.join(" · ")}` : ""}\n`;
  const exception = typeof entry.exception === "string" ? entry.exception : null;
  if (exception === null || (level !== "ERROR" && level !== "FATAL")) return summary;
  return `${summary}${exception
    .split("\n")
    .map((frame) => paint(`  ${frame}`, "red", useColor))
    .join("\n")}\n`;
}
