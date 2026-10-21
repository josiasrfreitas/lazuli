import type { Prisma } from "@lazuli/db";
import type { PlanningClassContext, PlanningDetail, PlanningRevision } from "./types.js";
import type { RevisionPage } from "../class-records/types.js";
import { timeOnly } from "../class-records/data.js";
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
import { planningRecords } from "./records.js";
const UPCOMING_DATES = 6;
const HISTORY_PAGE_SIZE = 25;
const contextSelect = {
  ...responsibilitySelect,
  id: true,
  portalClassName: true,
  scheduleType: true,
  semester: { select: { name: true } },
  substitutions: { select: { id: true } },
  enrollments: {
    select: {
      exitDate: true,
      student: { select: { id: true, fullName: true } },
      progressRecords: {
        select: { id: true, stage: { select: stageSelect }, startDate: true, endDate: true },
      },
    },
  },
} satisfies Prisma.ClassSelect;
type ContextRow = Prisma.ClassGetPayload<{ select: typeof contextSelect }>;
export async function planningContexts(context: PlanningContext): Promise<PlanningClassContext[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const rows = await loadContextRows(context);
  return rows
    .filter(
      (row) =>
        context.staffUser.role !== "TEACHER" ||
        usualTeacherOn(row, today)?.id === context.staffUser.id ||
        row.substitutions.length > 0,
    )
    .map((row) => contextItem(row, today));
}
async function loadContextRows(context: PlanningContext): Promise<ContextRow[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const teacher = context.staffUser.role === "TEACHER";
  return context.database.class.findMany({
    where: { deletedAt: null, ...(teacher ? { status: "ACTIVE" as const } : {}) },
    orderBy: [{ semester: { startDate: "desc" } }, { portalClassName: "asc" }],
    select: {
      ...contextSelect,
      substitutions: {
        ...contextSelect.substitutions,
        where: {
          teacherId: context.staffUser.id,
          date: { gte: today },
          revokedAt: null,
          deletedAt: null,
        },
      },
      enrollments: {
        where: {
          deletedAt: null,
          ...(teacher ? { OR: [{ exitDate: null }, { exitDate: { gt: today } }] } : {}),
          student: { deletedAt: null },
        },
        select: {
          ...contextSelect.enrollments.select,
          progressRecords: {
            ...contextSelect.enrollments.select.progressRecords,
            where: { deletedAt: null },
            orderBy: { startDate: "asc" },
          },
        },
      },
    },
  });
}
function contextItem(row: ContextRow, today: Date): PlanningClassContext {
  const students = row.enrollments
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
      (left, right) =>
        Number(left.historical) - Number(right.historical) ||
        left.name.localeCompare(right.name, "pt-BR") ||
        right.startOn.localeCompare(left.startOn),
    );
  return {
    id: row.id,
    name: row.portalClassName,
    scheduleType: row.scheduleType,
    semester: row.semester.name,
    students: row.scheduleType === "REGULAR" ? [] : students,
  };
}
export async function readPlanning(
  context: PlanningContext,
  target: StagePlanTarget,
): Promise<PlanningDetail> {
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
    records: plan ? await planningRecords(context, { scope, plan }) : [],
    upcoming: sessions.map((session) => ({
      id: session.id,
      date: dateOnly(session.date),
      time: timeOnly(session.startTime),
    })),
  };
}
export async function planningHistory(
  context: PlanningContext,
  target: StagePlanTarget & { cursor?: number | undefined },
): Promise<RevisionPage<PlanningRevision>> {
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
