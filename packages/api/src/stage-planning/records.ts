import type { ClassRecordSnapshot } from "@lazuli/validators";
import { sessionEndInstant } from "@lazuli/domain";
import { canRead, recordSessionInclude, storedSnapshot, timeOnly } from "../class-records/data.js";
import { dateOnly, type Plan, type PlanningContext, type PlanningScope } from "./data.js";

/** Only performed content for this plan's owner; no other student's snapshot leaves this read. */
export async function planningRecords(context: PlanningContext, scope: PlanningScope, plan: Plan) {
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
      const content = contentForPlan(snapshot, scope, plan.id);
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
  scope: Pick<PlanningScope, "student" | "progressId">,
  planId: string,
) {
  if (!scope.student) return snapshot?.sharedContent ?? null;
  const entry = snapshot?.entries.find(
    (row) =>
      row.studentId === scope.student!.id &&
      (row.progressId === scope.progressId || row.planned?.planId === planId),
  );
  return entry?.status === "PRESENT" ? entry.content : null;
}
