/** The deploy healthcheck uses a fixed path; arbitrary filesystem paths are rejected. */
export function workerReadinessEnabled(): boolean {
  const path = process.env.LAZULI_WORKER_READY_FILE;
  if (path !== undefined && path !== "/tmp/lazuli-worker-ready") {
    throw new Error("LAZULI_WORKER_READY_FILE must be /tmp/lazuli-worker-ready");
  }
  return path !== undefined;
}

/** Local telemetry stays off unless verification is explicitly enabled. */
export function readWorkerTelemetry(): {
  dsn: string | undefined;
  environment: string | undefined;
  verification: string | undefined;
  release: string | undefined;
} {
  return {
    dsn: process.env.SENTRY_WORKER_DSN,
    environment: process.env.LAZULI_ENV,
    verification: process.env.SENTRY_VERIFY,
    release: process.env.SENTRY_RELEASE,
  };
}
