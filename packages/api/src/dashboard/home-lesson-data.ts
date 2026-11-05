import type { responsibleTeacher } from "../class-records/data.js";
import type { Prisma } from "@lazuli/db";
import { loadTeacherIdentities } from "../teachers/identity-data.js";

type ResponsibleSession = Parameters<typeof responsibleTeacher>[0];
type PendingLessonSession = ResponsibleSession & {
  startTime: Date;
  endTime: Date;
  class: ResponsibleSession["class"] & { portalClassName: string };
};
type SessionScope = { classId: string; date: Date };

/** Pending previews have no record and need only the responsible teacher's identity. */
export async function loadPendingLessonSessions(
  database: Prisma.TransactionClient,
  { where, page }: { where: Prisma.ClassSessionWhereInput; page: { skip: number; take: number } },
): Promise<PendingLessonSession[]> {
  const sessions = await database.classSession.findMany({
    where,
    ...page,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      classId: true,
      scheduleSlotId: true,
      usualTeacherId: true,
      responsibilityFrozenAt: true,
    },
  });
  if (sessions.length === 0) return [];
  const byClass = await loadPendingClasses(database, sessions);
  return sessions.map((row) => ({ ...row, classRecord: null, class: byClass.get(row.classId)! }));
}

async function loadPendingClasses(
  database: Prisma.TransactionClient,
  sessions: SessionScope[],
): Promise<Map<string, PendingLessonSession["class"]>> {
  const classes = await database.class.findMany({
    where: { id: { in: [...new Set(sessions.map((row) => row.classId))] }, deletedAt: null },
    select: {
      id: true,
      portalClassName: true,
      teacherId: true,
      teacherAssignments: {
        where: { supersededAt: null },
        orderBy: { effectiveDate: "desc" },
        select: { id: true, effectiveDate: true, teacherId: true },
      },
      substitutions: {
        where: { revokedAt: null, deletedAt: null, date: { in: sessions.map((row) => row.date) } },
        orderBy: { recordedAt: "desc" },
        select: { teacherId: true, date: true, scheduleSlotId: true, classSessionId: true },
      },
    },
  });
  const teachers = await loadTeacherIdentities(
    database,
    classes.flatMap((row) => [
      row.teacherId,
      ...row.teacherAssignments.map((item) => item.teacherId),
      ...row.substitutions.map((item) => item.teacherId),
    ]),
  );
  return new Map(
    classes.map((row) => [
      row.id,
      {
        ...row,
        teacher: teachers.get(row.teacherId)!,
        teacherAssignments: row.teacherAssignments.map((item) => ({
          ...item,
          teacher: teachers.get(item.teacherId)!,
        })),
        substitutions: row.substitutions.map((item) => ({
          ...item,
          teacher: teachers.get(item.teacherId)!,
        })),
      },
    ]),
  );
}
