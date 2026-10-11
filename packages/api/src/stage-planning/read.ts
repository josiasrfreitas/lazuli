import type { StagePlanTarget } from "@lazuli/validators";
import { stagePlanSnapshotSchema } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import {
  loadPlanningScope,
  loadPlan,
  planSnapshot,
  stageSelect,
  dateOnly,
  type PlanningContext,
} from "./data.js";
const UPCOMING_DATES = 6;
const HISTORY_PAGE_SIZE = 20;
export async function planningContexts(context: PlanningContext) {
  const today = new Date(saoPauloDateOnly(context.now));
  const rows = await context.database.class.findMany({
    where: {
      deletedAt: null,
      ...(context.staffUser.role === "TEACHER" ? { status: "ACTIVE" as const } : {}),
    },
    orderBy: [{ semester: { startDate: "desc" } }, { portalClassName: "asc" }],
    select: {
      ...responsibilitySelect,
      id: true,
      portalClassName: true,
      scheduleType: true,
      semester: { select: { name: true } },
      enrollments: {
        where: {
          deletedAt: null,
          ...(context.staffUser.role === "TEACHER"
            ? { OR: [{ exitDate: null }, { exitDate: { gt: today } }] }
            : {}),
          student: { deletedAt: null },
        },
        select: {
          exitDate: true,
          student: { select: { id: true, fullName: true } },
          progressRecords: {
            where: { deletedAt: null },
            orderBy: { startDate: "asc" },
            select: { id: true, stage: { select: stageSelect }, startDate: true, endDate: true },
          },
        },
      },
    },
  });
  return rows
    .filter(
      (row) =>
        context.staffUser.role !== "TEACHER" ||
        usualTeacherOn(row, today)?.id === context.staffUser.id,
    )
    .map((row) => ({
      id: row.id,
      name: row.portalClassName,
      scheduleType: row.scheduleType,
      semester: row.semester.name,
      students:
        row.scheduleType === "REGULAR"
          ? []
          : row.enrollments
              .flatMap((enrollment) =>
                enrollment.progressRecords.map((progress) => ({
                  progressId: progress.id,
                  studentId: enrollment.student.id,
                  name: enrollment.student.fullName,
                  stage: progress.stage.name,
                  startOn: dateOnly(progress.startDate),
                  historical: Boolean(
                    (progress.endDate && progress.endDate <= today) ||
                    (enrollment.exitDate && enrollment.exitDate <= today),
                  ),
                })),
              )
              .toSorted(
                (a, b) =>
                  Number(a.historical) - Number(b.historical) ||
                  a.name.localeCompare(b.name, "pt-BR") ||
                  b.startOn.localeCompare(a.startOn),
              ),
    }));
}
export async function readPlanning(context: PlanningContext, target: StagePlanTarget) {
  const scope = await loadPlanningScope(context, target);
  const plan = await loadPlan(context, scope);
  const sessions = await context.database.classSession.findMany({
    where: {
      classId: scope.class.id,
      deletedAt: null,
      status: "SCHEDULED",
      date: { gte: new Date(scope.today) },
    },
    select: { id: true, date: true, startTime: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: UPCOMING_DATES,
  });
  return {
    scope,
    plan: plan
      ? { id: plan.id, version: plan.version, updatedAt: plan.updatedAt, ...planSnapshot(plan) }
      : null,
    upcoming: sessions.map((session) => ({
      id: session.id,
      date: dateOnly(session.date),
      time: session.startTime.toISOString().slice(11, 16),
    })),
  };
}
export async function planningHistory(
  context: PlanningContext,
  target: StagePlanTarget & { cursor?: number },
) {
  const scope = await loadPlanningScope(context, target);
  const plan = await loadPlan(context, scope);
  if (!plan) return { items: [], nextCursor: undefined };
  const rows = await context.database.stagePlanRevision.findMany({
    where: { planId: plan.id, ...(target.cursor ? { version: { lt: target.cursor } } : {}) },
    include: { recordedBy: { select: { name: true } } },
    orderBy: { version: "desc" },
    take: HISTORY_PAGE_SIZE + 1,
  });
  const items = rows.slice(0, HISTORY_PAGE_SIZE).map((row) => ({
    id: row.id,
    version: row.version,
    reason: row.reason,
    createdAt: row.createdAt,
    recordedBy: row.recordedBy.name,
    snapshot: stagePlanSnapshotSchema.parse(row.snapshot),
  }));
  return { items, nextCursor: rows.length > HISTORY_PAGE_SIZE ? items.at(-1)?.version : undefined };
}
