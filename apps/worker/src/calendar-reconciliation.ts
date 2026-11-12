import { db } from "@lazuli/db";
import { processCalendarReconciliation } from "@lazuli/worker-handlers/calendar";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

export function startCalendarReconciliation(): () => void {
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const requestId = await processCalendarReconciliation(db);
      if (requestId) logger.info({ request_id: requestId }, "Academic calendar reconciled");
    } catch (error) {
      logger.error(safeError(error), "Academic calendar reconciliation failed");
    } finally {
      running = false;
    }
  };
  void poll();
  const timer = setInterval(() => void poll(), 5000);
  return () => clearInterval(timer);
}
