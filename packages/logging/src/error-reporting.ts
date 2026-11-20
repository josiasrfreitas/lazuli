/** The application runtime supplies the transport; shared packages never depend on an SDK. */
export type ErrorReporter = (error: Error, tags: Record<string, string>) => void;
type ErrorReportingState = {
  reporter: ErrorReporter | undefined;
  reported: WeakSet<Error>;
};

// Next.js can load instrumentation and route handlers from separate server bundles.
const runtime = globalThis as typeof globalThis & {
  lazuliErrorReportingState?: ErrorReportingState;
};
const state = (runtime.lazuliErrorReportingState ??= {
  reporter: undefined,
  reported: new WeakSet(),
});

export const originalError = Symbol.for("lazuli.original-error");

export function setErrorReporter(next: ErrorReporter | undefined): void {
  state.reporter = next;
  state.reported = new WeakSet();
}

/** Pass the original exception, including its cause and stack, exactly once per process. */
export function reportError(error: Error, tags: Record<string, string> = {}): void {
  const { reporter } = state;
  if (!reporter || state.reported.has(error)) return;
  try {
    reporter(error, tags);
    state.reported.add(error);
  } catch {
    // Monitoring outages must never replace the application error or interrupt a job.
  }
}
