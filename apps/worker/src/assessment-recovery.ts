import { recoverAssessmentFiles } from "@lazuli/worker-handlers/assessment-files";
import { db } from "@lazuli/db";

const RECOVERY_POLL_MS = 15_000;

/** Durable RECEIVED rows survive a failed dispatch; the worker recovers them locally. */
export function startAssessmentRecovery(): () => void {
  let recovering = false;
  const recover = async (): Promise<void> => {
    if (recovering) return;
    recovering = true;
    try {
      await recoverAssessmentFiles(db);
    } catch {
      process.stdout.write("[worker] assessment file recovery failed\n");
    } finally {
      recovering = false;
    }
  };
  const timer = setInterval(() => void recover(), RECOVERY_POLL_MS);
  void recover();
  return () => clearInterval(timer);
}
