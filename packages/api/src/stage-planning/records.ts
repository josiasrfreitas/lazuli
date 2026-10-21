import type { PlanningRecord } from "./types.js";
import type { ClassRecordSnapshot } from "@lazuli/validators";
import { sessionEndInstant } from "@lazuli/domain";
import { canRead, recordSessionInclude, storedSnapshot, timeOnly } from "../class-records/data.js";
import { dateOnly, type Plan, type PlanningContext, type PlanningScope } from "./data.js";

/** Only performed content for this plan's owner; no other student's snapshot leaves this read. */
export async function planningRecords(
  context: PlanningContext,
  input: { scope: PlanningScope; plan: Plan },
): Promise<PlanningRecord[]> {
  const { scope, plan } = input;
  const progressIds = await linkedProgressIds(context, { scope, plan });
  const sessions = await context.database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      date: { gte: plan.plannedStartOn, lte: new Date(scope.today) },
      ...(scope.student
        ? {
            class: {
              enrollments: {
                some: {
                  studentId: scope.student.id,
                  progressRecords: { some: { stagePlanId: plan.id } },
                },
              },
            },
          }
        : { classId: scope.class.id }),
      classRecord: { isNot: null },
    },
    include: recordSessionInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
  });
  return sessions
    .filter((session) => canRead(context, session) && sessionEndInstant(session) <= context.now)
    .flatMap((session) => {
      const snapshot = storedSnapshot(session);
      const content = contentForPlan(snapshot, {
        studentId: scope.student?.id ?? null,
        progressIds,
        planId: plan.id,
      });
      if (!content) return [];
      return [
        {
          id: session.id,
          classId: session.classId,
          date: dateOnly(session.date),
          time: timeOnly(session.startTime),
          content,
        },
      ];
    });
}

export function contentForPlan(
  snapshot: ClassRecordSnapshot | null,
  input: { studentId: string | null; progressIds: ReadonlySet<string>; planId: string },
): ClassRecordSnapshot["sharedContent"] {
  const { studentId, progressIds, planId } = input;
  if (!studentId) return snapshot?.sharedContent ?? null;
  const entry = snapshot?.entries.find(
    (row) =>
      row.studentId === studentId &&
      ((row.progressId !== null && progressIds.has(row.progressId)) ||
        row.planned?.planId === planId),
  );
  return entry?.status === "PRESENT" ? entry.content : null;
}

async function linkedProgressIds(
  context: PlanningContext,
  { scope, plan }: { scope: PlanningScope; plan: Plan },
): Promise<Set<string>> {
  if (!scope.student) return new Set();
  const rows = await context.database.pedagogicalProgress.findMany({
    where: { stagePlanId: plan.id, enrollment: { studentId: scope.student.id } },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}
