import type {
  ClientOptions,
  Event,
  ErrorEvent,
  EventHint,
  TransactionEvent,
  DataCollection,
  Log,
} from "@sentry/core";

/** Never collect student content, credentials, file contents, or request/queue payloads. */
export const privateDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
};

export function telemetryEnabled(environment: string | undefined, verification?: string): boolean {
  return environment === "prod" || verification === "1";
}

/** Keep the diagnostic message, but remove common identifying values and credential-bearing URLs. */
export function redactDiagnostic(value: string): string {
  return value
    .replaceAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[email]")
    .replaceAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/gu, "[document]")
    .replaceAll(/(https?:\/\/|postgres(?:ql)?:\/\/)[^\s/@]+:[^\s/@]+@/giu, "$1[credentials]@")
    .replaceAll(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/giu, "$1[credential]");
}

export function sanitizeTelemetry<T extends Event | TransactionEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  if (event.request) {
    const url = event.request.url?.split(/[?#]/u)[0];
    event.request = {
      ...(url ? { url } : {}),
      ...(event.request.method ? { method: event.request.method } : {}),
    };
  }
  redactExceptions(event.exception?.values ?? []);
  if (event.message) event.message = redactDiagnostic(event.message);
  return event;
}

function redactExceptions(
  exceptions: NonNullable<NonNullable<Event["exception"]>["values"]>,
): void {
  for (const exception of exceptions) {
    if (exception.value) exception.value = redactDiagnostic(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }
}

type TelemetryOptions = Pick<
  ClientOptions,
  | "dsn"
  | "enabled"
  | "environment"
  | "release"
  | "traceLifecycle"
  | "tracesSampleRate"
  | "dataCollection"
  | "beforeSend"
  | "beforeSendTransaction"
  | "beforeSendLog"
  | "beforeBreadcrumb"
>;
const PRODUCTION_TRACE_SAMPLE_RATE = 0.1;

/** Technical tags only: never attach inputs, user names, documents or database values. */
export function sentryOptions(input: {
  dsn?: string | undefined;
  environment?: string | undefined;
  verification?: string | undefined;
  release?: string | undefined;
}): TelemetryOptions {
  return {
    dsn: input.dsn,
    enabled: Boolean(input.dsn) && telemetryEnabled(input.environment, input.verification),
    environment: input.verification === "1" ? "verification" : input.environment,
    release: input.release,
    traceLifecycle: "static",
    tracesSampleRate: input.verification === "1" ? 1 : PRODUCTION_TRACE_SAMPLE_RATE,
    dataCollection: privateDataCollection,
    beforeSend: (event: ErrorEvent, _hint: EventHint) => sanitizeTelemetry(event),
    beforeSendTransaction: (event: TransactionEvent) => sanitizeTelemetry(event),
    beforeSendLog: (log: Log) => {
      if (typeof log.message !== "string") return null;
      return {
        ...log,
        message: redactDiagnostic(log.message),
        attributes: Object.fromEntries(
          Object.entries(log.attributes ?? {}).filter(([key]) =>
            [
              "service_name",
              "job_name",
              "procedure",
              "error_code",
              "checkpoint",
              "status",
              "duration_ms",
            ].includes(key),
          ),
        ),
      };
    },
    // Console/form content may include school data; application logs use reviewed attributes.
    beforeBreadcrumb: () => null,
  };
}
