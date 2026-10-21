import type { ClassRecordSnapshot } from "@lazuli/validators";
import { usualTeacherOn } from "../teachers/responsibility.js";
import { badRequest } from "../trpc/errors.js";
import type { RecordContext, RecordSession } from "./data.js";

export async function commitAttendance(
  context: RecordContext,
  input: {
    session: RecordSession;
    entries: Pick<ClassRecordSnapshot["entries"][number], "enrollmentId" | "status">[];
  },
): Promise<void> {
  const { session, entries } = input;
  const current = await context.database.attendance.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { id: true, enrollmentId: true, status: true },
  });
  const ids = new Set(entries.map((row) => row.enrollmentId));
  if (current.some((row) => !ids.has(row.enrollmentId)))
    throw badRequest(
      "A frequência registrada diverge da matrícula histórica. Revise a movimentação antes de dar baixa.",
    );
  for (const row of entries) {
    const existing = current.find((entry) => entry.enrollmentId === row.enrollmentId);
    if (!existing)
      await context.database.attendance.create({
        data: {
          classSessionId: session.id,
          enrollmentId: row.enrollmentId,
          status: row.status,
          recordedAt: context.now,
          recordedById: context.staffUser.id,
        },
      });
    else if (existing.status !== row.status)
      await context.database.attendance.update({
        where: { id: existing.id },
        data: {
          status: row.status,
          lastModifiedAt: context.now,
          lastModifiedById: context.staffUser.id,
        },
      });
  }
  await stampSession(context, session);
}
async function stampSession(context: RecordContext, session: RecordSession): Promise<void> {
  await context.database.classSession.update({
    where: { id: session.id },
    data: {
      ...(session.responsibilityFrozenAt
        ? {}
        : {
            usualTeacherId: usualTeacherOn(session.class, session.date)?.id ?? null,
            responsibilityFrozenAt: context.now,
          }),
      ...(session.attendanceConfirmedAt
        ? {}
        : { attendanceConfirmedAt: context.now, attendanceConfirmedById: context.staffUser.id }),
      attendanceLastCommittedAt: context.now,
    },
  });
}
