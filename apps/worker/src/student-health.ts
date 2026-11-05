import { db } from "@lazuli/db";
import { refreshStudentHealthPending } from "@lazuli/worker-handlers";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

const REFRESH_MS = 60_000;
export function startStudentHealthRefresh(): () => void {
  let running = false;
  const refresh = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await refreshStudentHealthPending(db);
    } catch (error) {
      logger.error(safeError(error), "Student health refresh failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  void refresh();
  return () => clearInterval(timer);
}
