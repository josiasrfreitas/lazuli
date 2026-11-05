import { recoverStudentDocuments } from "@lazuli/worker-handlers/student-documents";
import { recoverAssessmentFiles } from "@lazuli/worker-handlers/assessment-files";
import { db } from "@lazuli/db";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

const RECOVERY_POLL_MS = 15_000;

/** Durable RECEIVED rows survive a failed dispatch; the worker recovers them locally. */
export function startAssessmentRecovery(): () => void {
  let recovering = false;
  const recover = async (): Promise<void> => {
    if (recovering) return;
    recovering = true;
    try {
      await recoverAssessmentFiles(db);
      await recoverStudentDocuments(db);
    } catch (error) {
      logger.error(safeError(error), "Assessment file recovery failed");
    } finally {
      recovering = false;
    }
  };
  const timer = setInterval(() => void recover(), RECOVERY_POLL_MS);
  void recover();
  return () => clearInterval(timer);
}
