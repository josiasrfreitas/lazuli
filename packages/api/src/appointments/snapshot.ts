import type { AppointmentSnapshot } from "@lazuli/validators";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { appointmentTeacher, sourceApplicable, type AppointmentRow } from "./data.js";

/** Serializable evidence: historical names and source state do not change with later edits. */
export function appointmentSnapshot(row: AppointmentRow): AppointmentSnapshot {
  return {
    id: row.id,
    version: row.version,
    student: { id: row.student.id, name: row.student.fullName },
    teacher: appointmentTeacher(row),
    enrollmentId: row.enrollmentId,
    targetClassSessionId: row.targetClassSessionId,
    targetClassName: row.targetClassSession?.class.portalClassName ?? null,
    legacyMakeupId: row.legacyMakeupId,
    rescheduledFromId: row.rescheduledFromId,
    purpose: row.purpose,
    status: row.status,
    format: row.format,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
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
      date: dateOnly(source.classSession.date),
      startTime: timeOnly(source.classSession.startTime),
      endTime: timeOnly(source.classSession.endTime),
      sourceStatus: source.status,
      applicable: sourceApplicable(source),
    })),
  };
}
