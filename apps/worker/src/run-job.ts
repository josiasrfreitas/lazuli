import { randomUUID } from "node:crypto";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

export async function runJob<Result>(
  jobName: string,
  action: () => Promise<Result>,
): Promise<Result> {
  const jobLogger = logger.child({ job_id: randomUUID(), job_name: jobName });
  const started = performance.now();
  jobLogger.info("Worker job started");
  try {
    const result = await action();
    jobLogger.info(
      { duration_ms: Math.round(performance.now() - started) },
      "Worker job completed",
    );
    return result;
  } catch (error) {
    jobLogger.error(
      { duration_ms: Math.round(performance.now() - started), ...safeError(error) },
      "Worker job failed",
    );
    throw error;
  }
}
