import { createServiceLogger } from "@lazuli/logging";
import type { Context } from "../trpc/context.js";

const logger = createServiceLogger("web");

/** Called after commit: a queue outage must not roll back the confirmed calendar change. */
export async function dispatchCalendarReconciliation(
  context: Context,
  requestId: string,
): Promise<boolean> {
  if (!context.calendarReconciliationQueue) return false;
  try {
    await context.calendarReconciliationQueue.enqueue(requestId);
    return true;
  } catch {
    logger.warn({ request_id: requestId }, "Calendar update saved; worker dispatch unavailable");
    return false;
  }
}
