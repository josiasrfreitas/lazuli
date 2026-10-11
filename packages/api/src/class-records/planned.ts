import { sessionEndInstant } from "@lazuli/domain";
import { stagePlanSnapshotSchema, type ClassRecordSnapshot } from "@lazuli/validators";
import { dateOnly, type RecordContext, type RecordSession } from "./data.js";
type Planned = ClassRecordSnapshot["sharedPlanned"];
export async function plannedAtEncounter(
  context: RecordContext,
  session: RecordSession,
  planId: string | null,
): Promise<Planned> {
  if (!planId) return null;
  const cutoff = new Date(Math.min(context.now.getTime(), sessionEndInstant(session).getTime()));
  const revision = await context.database.stagePlanRevision.findFirst({
    where: { planId, deletedAt: null, createdAt: { lte: cutoff } },
    orderBy: [{ version: "desc" }],
  });
  if (!revision) return null;
  return {
    planId,
    revisionId: revision.id,
    version: revision.version,
    items: stagePlanSnapshotSchema
      .parse(revision.snapshot)
      .items.filter((item) => item.plannedOn === dateOnly(session.date)),
  };
}
export async function initialSnapshot(
  context: RecordContext,
  session: RecordSession,
): Promise<ClassRecordSnapshot> {
  const rows = await context.database.enrollment.findMany({
    where: {
      classId: session.classId,
      deletedAt: null,
      entryDate: { lte: session.date },
      OR: [{ exitDate: null }, { exitDate: { gt: session.date } }],
      student: { deletedAt: null },
    },
    select: {
      id: true,
      student: { select: { id: true, fullName: true } },
      progressRecords: {
        where: {
          deletedAt: null,
          startDate: { lte: session.date },
          OR: [{ endDate: null }, { endDate: { gte: session.date } }],
        },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { id: true, stagePlanId: true, stage: { select: { name: true } } },
      },
    },
    orderBy: { student: { fullName: "asc" } },
  });
  const attendance = await context.database.attendance.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { enrollmentId: true, status: true },
  });
  const regular = session.class.scheduleType === "REGULAR";
  const sharedPlan = regular
    ? await context.database.stagePlan.findUnique({
        where: { classId: session.classId },
        select: { id: true },
      })
    : null;
  return {
    note: null,
    sharedContent: null,
    sharedPlanned: await plannedAtEncounter(context, session, sharedPlan?.id ?? null),
    entries: await Promise.all(
      rows.map(async (row) => ({
        enrollmentId: row.id,
        studentId: row.student.id,
        name: row.student.fullName,
        progressId: row.progressRecords[0]?.id ?? null,
        stage: row.progressRecords[0]?.stage.name ?? session.class.sharedStage?.name ?? null,
        status: attendance.find((entry) => entry.enrollmentId === row.id)?.status ?? "PRESENT",
        content: null,
        planned: regular
          ? null
          : await plannedAtEncounter(context, session, row.progressRecords[0]?.stagePlanId ?? null),
      })),
    ),
  };
}
