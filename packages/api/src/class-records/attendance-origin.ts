import type { ClassRecordSnapshot } from "@lazuli/validators";
import type { RecordContext, RecordSession } from "./data.js";

/** Snapshot the legacy attribution before the first diary correction mutates attendance. */
export async function preserveAttendance(
  context: RecordContext,
  session: RecordSession,
): Promise<NonNullable<ClassRecordSnapshot["attendanceOrigin"]>> {
  const [confirmation, rows] = await Promise.all([
    context.database.classSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { attendanceConfirmedBy: { select: { id: true, name: true } } },
    }),
    context.database.attendance.findMany({
      where: { classSessionId: session.id, deletedAt: null },
      select: {
        enrollmentId: true,
        recordedAt: true,
        lastModifiedAt: true,
        recordedBy: { select: { id: true, name: true } },
        lastModifiedBy: { select: { id: true, name: true } },
      },
    }),
  ]);
  return {
    confirmedBy: confirmation.attendanceConfirmedBy,
    entries: rows.map((row) => ({
      enrollmentId: row.enrollmentId,
      recordedBy: row.recordedBy,
      recordedAt: row.recordedAt.toISOString(),
      modifiedBy: row.lastModifiedBy,
      modifiedAt: row.lastModifiedAt?.toISOString() ?? null,
    })),
  };
}
