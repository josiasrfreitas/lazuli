import type { Prisma } from "@lazuli/db";
import { lockStudentEnrollment } from "./data.js";
import { dateOnlyUtc } from "./effective-date.js";
import { saoPauloDateOnly } from "@lazuli/domain";

import { badRequest, notFound } from "../trpc/errors.js";

type Database = Pick<
  Prisma.TransactionClient,
  "enrollmentAction" | "enrollment" | "pedagogicalProgress" | "$queryRaw"
>;

/** Cancellation is a recorded status change; a future entry's rows are soft-deleted. */
export async function cancelScheduledAction(input: {
  database: Database;
  actionId: string;
  staffUserId: string;
  now: Date;
}): Promise<{ id: string; status: "CANCELLED" }> {
  const action = await input.database.enrollmentAction.findUnique({
    where: { id: input.actionId },
    select: {
      id: true,
      enrollmentId: true,
      kind: true,
      status: true,
      effectiveDate: true,
      enrollment: { select: { studentId: true } },
    },
  });
  if (action === null) throw notFound("Programação não encontrada.");
  if (
    action.status !== "SCHEDULED" ||
    dateOnlyUtc(action.effectiveDate) <= saoPauloDateOnly(input.now)
  ) {
    throw badRequest("A programação só pode ser cancelada antes da data efetiva.");
  }
  await lockStudentEnrollment(input.database, action.enrollment.studentId);
  const result = await input.database.enrollmentAction.updateMany({
    where: { id: action.id, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelledAt: input.now, cancelledById: input.staffUserId },
  });
  if (result.count !== 1) throw badRequest("A programação já foi alterada.");
  if (action.kind === "ENTRY" || action.kind === "RETURN") {
    await input.database.pedagogicalProgress.updateMany({
      where: { enrollmentId: action.enrollmentId, deletedAt: null },
      data: { deletedAt: input.now },
    });
    await input.database.enrollment.update({
      where: { id: action.enrollmentId },
      data: { deletedAt: input.now },
    });
  }
  return { id: action.id, status: "CANCELLED" as const };
}
