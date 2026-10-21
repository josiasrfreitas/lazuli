import type { Prisma } from "@lazuli/db";
import { sessionEndInstant } from "@lazuli/domain";
import { stagePlanSnapshotSchema, type ClassRecordSnapshot } from "@lazuli/validators";
import { dateOnly, type RecordContext, type RecordSession } from "./data.js";

type Planned = ClassRecordSnapshot["sharedPlanned"];
export async function plannedAtEncounter(
  context: RecordContext,
  input: { session: RecordSession; planId: string | null },
): Promise<Planned> {
  if (!input.planId) return null;
  const cutoff = new Date(
    Math.min(context.now.getTime(), sessionEndInstant(input.session).getTime()),
  );
  const revision = await context.database.stagePlanRevision.findFirst({
    where: { planId: input.planId, deletedAt: null, createdAt: { lte: cutoff } },
    orderBy: [{ version: "desc" }],
  });
  if (!revision) return null;
  return {
    planId: input.planId,
    revisionId: revision.id,
    version: revision.version,
    items: stagePlanSnapshotSchema
      .parse(revision.snapshot)
      .items.filter((item) => item.plannedOn === dateOnly(input.session.date)),
  };
}
const rosterSelect = {
  id: true,
  student: { select: { id: true, fullName: true } },
  progressRecords: { select: { id: true, stagePlanId: true, stage: { select: { name: true } } } },
} satisfies Prisma.EnrollmentSelect;
type RosterRow = Prisma.EnrollmentGetPayload<{ select: typeof rosterSelect }>;
async function historicalRoster(
  context: RecordContext,
  session: RecordSession,
): Promise<RosterRow[]> {
  return context.database.enrollment.findMany({
    where: {
      classId: session.classId,
      deletedAt: null,
      entryDate: { lte: session.date },
      OR: [{ exitDate: null }, { exitDate: { gt: session.date } }],
      student: { deletedAt: null },
    },
    select: {
      ...rosterSelect,
      progressRecords: {
        ...rosterSelect.progressRecords,
        where: {
          deletedAt: null,
          startDate: { lte: session.date },
          OR: [{ endDate: null }, { endDate: { gte: session.date } }],
        },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
    orderBy: { student: { fullName: "asc" } },
  });
}
export async function initialSnapshot(
  context: RecordContext,
  session: RecordSession,
): Promise<ClassRecordSnapshot> {
  const rows = await historicalRoster(context, session);
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
    sharedPlanned: await plannedAtEncounter(context, { session, planId: sharedPlan?.id ?? null }),
    entries: await Promise.all(
      rows.map((row) => snapshotEntry(context, { session, row, attendance })),
    ),
  };
}
async function snapshotEntry(
  context: RecordContext,
  input: {
    session: RecordSession;
    row: RosterRow;
    attendance: { enrollmentId: string; status: "PRESENT" | "ABSENT" }[];
  },
): Promise<ClassRecordSnapshot["entries"][number]> {
  const { session, row, attendance } = input;
  const progress = row.progressRecords[0];
  const planned =
    session.class.scheduleType === "REGULAR"
      ? null
      : await plannedAtEncounter(context, { session, planId: progress?.stagePlanId ?? null });
  return {
    enrollmentId: row.id,
    studentId: row.student.id,
    name: row.student.fullName,
    progressId: progress ? progress.id : null,
    stage: progress ? progress.stage.name : (session.class.sharedStage?.name ?? null),
    status: attendance.find((entry) => entry.enrollmentId === row.id)?.status ?? "PRESENT",
    content: null,
    planned,
  };
}
