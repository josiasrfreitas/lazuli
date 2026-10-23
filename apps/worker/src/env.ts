/** The deploy healthcheck uses a fixed path; arbitrary filesystem paths are rejected. */
export function workerReadinessEnabled(): boolean {
  const path = process.env.LAZULI_WORKER_READY_FILE;
  if (path !== undefined && path !== "/tmp/lazuli-worker-ready") {
    throw new Error("LAZULI_WORKER_READY_FILE must be /tmp/lazuli-worker-ready");
  }
  return path !== undefined;
}
