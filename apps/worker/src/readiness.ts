import { rm, writeFile } from "node:fs/promises";
import { workerReadinessEnabled } from "./env.js";

const READY_TIMEOUT_MS = 30_000;
const READY_FILE = "/tmp/lazuli-worker-ready";
type ReadyWorker = {
  start(): Promise<void>;
  stop(): Promise<void>;
  waitUntilReady(timeoutMs: number): Promise<void>;
};

/** Signals initial registration only; runtime failures must still stop the process. */
export async function runWithReadiness(worker: ReadyWorker): Promise<void> {
  const enabled = workerReadinessEnabled();
  try {
    if (enabled) await rm(READY_FILE, { force: true });
    const execution = worker.start();
    await Promise.race([
      worker.waitUntilReady(READY_TIMEOUT_MS),
      execution.then(() => {
        throw new Error("Worker stopped before readiness");
      }),
    ]);
    if (enabled) await writeFile(READY_FILE, "ready\n", { mode: 0o600 });
    await execution;
  } finally {
    if (enabled) await rm(READY_FILE, { force: true });
    await worker.stop();
  }
}
