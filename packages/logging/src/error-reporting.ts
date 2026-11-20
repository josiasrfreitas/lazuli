/** The application runtime supplies the transport; shared packages never depend on an SDK. */
export type ErrorReporter = (error: Error, tags: Record<string, string>) => void;
let reporter: ErrorReporter | undefined;
let reported = new WeakSet<Error>();
export const originalError = Symbol.for("lazuli.original-error");

export function setErrorReporter(next: ErrorReporter | undefined): void {
  reporter = next;
  reported = new WeakSet();
}

/** Pass the original exception, including its cause and stack, exactly once per process. */
export function reportError(error: Error, tags: Record<string, string> = {}): void {
  if (!reporter || reported.has(error)) return;
  try {
    reporter(error, tags);
    reported.add(error);
  } catch {
    // Monitoring outages must never replace the application error or interrupt a job.
  }
}
