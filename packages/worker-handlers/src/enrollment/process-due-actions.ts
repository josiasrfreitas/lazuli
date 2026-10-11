import type { TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";

import { reconcileDueSemesterPlacements } from "./semester-placements.js";

type Database = TransactionClient;

/** Applies due actions once; the action status is the concurrency guard across workers. */
export async function processDueEnrollmentActions(input: {
  database: Database;
  now: Date;
}): Promise<number> {
  const today = new Date(saoPauloDateOnly(input.now));
  await reconcileDueSemesterPlacements(input.database, today, input.now);
  const due = await input.database.enrollmentAction.findMany({
    where: { status: "SCHEDULED", effectiveDate: { lte: today } },
    select: { id: true, enrollmentId: true, kind: true, effectiveDate: true, exitReason: true },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
    take: 100,
  });
  let applied = 0;
  for (const action of due) {
    const claimed = await input.database.enrollmentAction.updateMany({
      where: { id: action.id, status: "SCHEDULED" },
      data: { status: "APPLIED" },
    });
    if (claimed.count === 0) continue;
    if (action.kind === "PAUSE" || action.kind === "EXIT") {
      const reason =
        action.kind === "PAUSE"
          ? "SUSPENDED"
          : action.exitReason === "TRANSFERRED"
            ? "TRANSFERRED"
            : "DROPPED";
      const enrollment = await input.database.enrollment.findUnique({
        where: { id: action.enrollmentId },
        select: { exitDate: true, deletedAt: true },
      });
      if (enrollment?.deletedAt !== null || enrollment.exitDate !== null) {
        await input.database.enrollmentAction.update({
          where: { id: action.id },
          data: { status: "CANCELLED", cancelledAt: input.now },
        });
        continue;
      }
      await input.database.pedagogicalProgress.updateMany({
        where: { enrollmentId: action.enrollmentId, endDate: null, deletedAt: null },
        data: { endDate: action.effectiveDate, endReason: reason },
      });
      await input.database.enrollment.update({
        where: { id: action.enrollmentId },
        data: { exitDate: action.effectiveDate, exitReason: reason },
      });
    }
    applied += 1;
  }
  return applied;
}
