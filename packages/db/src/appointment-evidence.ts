import type { Prisma } from "./generated/prisma/client.js";
import { responsibilitySelect, usualTeacherOn } from "./teacher-responsibility.js";

const person = { id: true, name: true } as const;
export const evidenceSessionInclude = {
  classRecord: { include: { teachingTeacher: { select: person } } },
  class: {
    select: {
      id: true,
      portalClassName: true,
      ...responsibilitySelect,
      substitutions: {
        where: { revokedAt: null, deletedAt: null },
        orderBy: { recordedAt: "desc" },
        select: {
          teacherId: true,
          date: true,
          scheduleSlotId: true,
          classSessionId: true,
          teacher: { select: person },
        },
      },
    },
  },
} satisfies Prisma.ClassSessionInclude;
export const appointmentEvidenceInclude = {
  student: { select: { id: true, fullName: true } },
  teacher: { select: person },
  scheduledBy: { select: person },
  recordedBy: { select: person },
  cancelledBy: { select: person },
  targetClassSession: { include: evidenceSessionInclude },
  coverages: {
    where: { deletedAt: null },
    orderBy: { attendanceId: "asc" },
    include: {
      attendance: {
        include: {
          enrollment: { include: { class: { select: { id: true, portalClassName: true } } } },
          classSession: { include: evidenceSessionInclude },
        },
      },
    },
  },
} satisfies Prisma.PedagogicalAppointmentInclude;
export type AppointmentEvidenceRow = Prisma.PedagogicalAppointmentGetPayload<{
  include: typeof appointmentEvidenceInclude;
}>;
type EvidenceSession = Prisma.ClassSessionGetPayload<{ include: typeof evidenceSessionInclude }>;
const civil = (value: Date) => value.toISOString().slice(0, 10);
const time = (value: Date) => value.toISOString().slice(11, 16);

export function evidenceSessionTeacher(
  session: Pick<
    EvidenceSession,
    "id" | "date" | "scheduleSlotId" | "classRecord" | "responsibilityFrozenAt" | "usualTeacherId"
  > & {
    class: Pick<
      EvidenceSession["class"],
      "teacherId" | "teacher" | "teacherAssignments" | "substitutions"
    >;
  },
) {
  if (session.classRecord) return session.classRecord.teachingTeacher;
  const substitute = session.class.substitutions.find(
    (row) =>
      row.date.getTime() === session.date.getTime() &&
      (session.scheduleSlotId
        ? row.scheduleSlotId === session.scheduleSlotId
        : row.classSessionId === session.id),
  );
  if (substitute) return substitute.teacher;
  if (session.responsibilityFrozenAt)
    return (
      [session.class.teacher, ...session.class.teacherAssignments.map((row) => row.teacher)].find(
        (row) => row.id === session.usualTeacherId,
      ) ?? null
    );
  return usualTeacherOn(session.class, session.date);
}
export function evidenceSourceApplicable(
  row: AppointmentEvidenceRow["coverages"][number]["attendance"],
) {
  const session = row.classSession;
  return (
    !row.deletedAt &&
    row.status === "ABSENT" &&
    !session.deletedAt &&
    session.status !== "CANCELLED" &&
    Boolean(session.attendanceConfirmedAt) &&
    !row.enrollment.deletedAt &&
    row.enrollment.classId === session.classId &&
    row.enrollment.entryDate <= session.date &&
    (!row.enrollment.exitDate || row.enrollment.exitDate > session.date)
  );
}
/** Serializable historical evidence shared by interactive writes and calendar reconciliation. */
export function createAppointmentEvidence(row: AppointmentEvidenceRow) {
  return {
    id: row.id,
    version: row.version,
    student: { id: row.student.id, name: row.student.fullName },
    teacher:
      row.targetClassSession && !row.recordedAt
        ? evidenceSessionTeacher(row.targetClassSession)
        : row.teacher,
    enrollmentId: row.enrollmentId,
    targetClassSessionId: row.targetClassSessionId,
    targetClassName: row.targetClassSession?.class.portalClassName ?? null,
    legacyMakeupId: row.legacyMakeupId,
    rescheduledFromId: row.rescheduledFromId,
    purpose: row.purpose,
    status: row.status,
    format: row.format,
    date: civil(row.date),
    startTime: time(row.startTime),
    endTime: time(row.endTime),
    plannedContent: row.plannedContent,
    performedContent: row.performedContent,
    performedMinutes: row.performedMinutes,
    notes: row.notes,
    scheduledAt: row.scheduledAt.toISOString(),
    scheduledBy: row.scheduledBy,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    recordedBy: row.recordedBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    coverages: row.coverages.map(({ attendance: source, attendanceId, minutes }) => ({
      attendanceId,
      minutes,
      enrollmentId: source.enrollmentId,
      sourceSessionId: source.classSessionId,
      sourceClassId: source.classSession.classId,
      sourceClassName: source.enrollment.class.portalClassName,
      date: civil(source.classSession.date),
      startTime: time(source.classSession.startTime),
      endTime: time(source.classSession.endTime),
      sourceStatus: source.status,
      applicable: evidenceSourceApplicable(source),
    })),
  };
}
