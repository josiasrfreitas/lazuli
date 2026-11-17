import { createHash } from "node:crypto";
import { recordedActivities } from "@lazuli/domain";
import { requireAppointmentAdmin } from "../appointments/data.js";
import { badRequest } from "../trpc/errors.js";
import { loadPlanningScope, assertEditable, type PlanningContext } from "./data.js";
import { recordRevision } from "./write.js";
import { readPlanning } from "./read.js";

export async function adjustmentPlanning(context: PlanningContext, classId: string) {
  requireAppointmentAdmin(context);
  const scope = await loadPlanningScope(context, { classId, lock: true });
  assertEditable(scope);
  if (scope.student || scope.class.scheduleType !== "REGULAR")
    throw badRequest("Este ajuste é para o planejamento compartilhado de uma turma regular.");
  const data = await readPlanning(context, { classId });
  const items = data.plan?.items ?? data.preview?.items ?? [];
  const completed = new Set(
    data.records.flatMap((record) =>
      recordedActivities(record.content)
        .filter((item) => item.status === "COMPLETED")
        .map((item) => item.id),
    ),
  );
  const remaining = items.filter((item) => !completed.has(item.id));
  const remainingMinutes = remaining.reduce(
    (sum, item) => sum + (item.curriculum?.durationMinutes ?? 0),
    0,
  );
  return {
    data,
    remainingMinutes,
    uncertain:
      items.length === 0 ||
      items.some((item) => !item.curriculum) ||
      data.calendar.unrecordedSessions > 0 ||
      data.records.some((record) => recordedActivities(record.content).length === 0),
  };
}
export const adjustmentFingerprint = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Adjust only outstanding dates; performed content and earlier revisions remain intact. */
export async function saveAdjustedProjection(
  context: PlanningContext,
  classId: string,
  reason: string,
) {
  const data = await readPlanning(context, { classId });
  if (!data.plan) return;
  const changed = data.projection.filter((row) => {
    const item = data.plan!.items.find((item) => item.id === row.itemId);
    return row.date && (item?.plannedOn !== row.date || item.plannedSessionId !== row.sessionId);
  });
  if (!changed.length) return;
  for (const row of changed)
    await context.database.stagePlanItem.update({
      where: { id: row.itemId },
      data: { plannedOn: new Date(row.date!), plannedSessionId: row.sessionId },
    });
  const lastDate = data.projection
    .flatMap((row) => (row.date ? [row.date] : []))
    .sort()
    .at(-1);
  await context.database.stagePlan.update({
    where: { id: data.plan.id },
    data: {
      version: { increment: 1 },
      ...(lastDate && lastDate > data.plan.plannedEndOn
        ? { plannedEndOn: new Date(lastDate) }
        : {}),
    },
  });
  await recordRevision(context, { scope: data.scope, planId: data.plan.id, reason });
}
