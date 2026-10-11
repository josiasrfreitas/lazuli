import type { TransactionClient } from "../../packages/db/src/client.js";
import type { StaffUser } from "../../packages/api/src/trpc/context.js";
import type { RecordSession } from "../../packages/api/src/class-records/data.js";
import {
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../../packages/api/src/teachers/availability.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { addDays, isoOf, stableUuid } from "../../packages/db/src/seed-dev-support.js";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";

/** Existing grades, observations, visits and makeups remain independent evidence. */
export async function safeAttendanceScenario(
  database: TransactionClient,
  session: RecordSession,
  wholeRoster: boolean,
): Promise<boolean> {
  const rows = await database.attendance.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { enrollmentId: true, enrollment: { select: { studentId: true } } },
  });
  if (rows.length === 0) return false;
  const studentIds = rows.map((row) => row.enrollment.studentId);
  const dayStart = new Date(session.date);
  dayStart.setUTCHours(3);
  const references = await Promise.all([
    database.pedagogicalOccurrence.count({
      where: wholeRoster ? { studentId: { in: studentIds } } : { classSessionId: session.id },
    }),
    database.pedagogicalFollowUp.count({
      where: {
        createdAt: { gte: dayStart, lt: addDays(dayStart, 1) },
        OR: [
          { occurrence: { studentId: { in: studentIds } } },
          { intervention: { studentId: { in: studentIds } } },
        ],
      },
    }),
    database.assessmentGrade.count({
      where: { assessedOn: session.date, assessment: { studentId: { in: studentIds } } },
    }),
    database.entryVisit.count({ where: { classSessionId: session.id } }),
    database.makeup.count({
      where: {
        OR: [
          { targetClassSessionId: session.id },
          { originEnrollmentId: { in: rows.map((row) => row.enrollmentId) } },
        ],
      },
    }),
  ]);
  return references.every((count) => count === 0);
}

export async function cancelSeedSession(
  database: TransactionClient,
  session: RecordSession,
  admin: StaffUser,
): Promise<void> {
  const cancelledAt = sessionEndInstant({ date: addDays(session.date, -1), endTime: "15:00" });
  // Preserve deterministic attendance identities, but cancelled sessions have no active call.
  await database.attendance.updateMany({
    where: { classSessionId: session.id, deletedAt: null },
    data: {
      deletedAt: cancelledAt,
      createdAt: cancelledAt,
      updatedAt: cancelledAt,
      recordedAt: cancelledAt,
    },
  });
  await database.classSession.update({
    where: { id: session.id },
    data: {
      status: "CANCELLED",
      cancelReason: "Encontro cancelado por manutenção da sala; famílias avisadas previamente.",
      cancelledAt,
      cancelledById: admin.id,
      attendanceConfirmedAt: null,
      attendanceConfirmedById: null,
      attendanceLastCommittedAt: null,
      usualTeacherId: null,
      responsibilityFrozenAt: null,
    },
  });
  await recordActivity(
    database,
    { staffUser: admin, now: cancelledAt },
    "classRecords.cancelSession",
    {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description: `${isoOf(session.date).split("-").reverse().join("/")} · Manutenção da sala; famílias avisadas previamente.`,
      deduplicationKey: `seed-class-record-cancel/${session.id}`,
    },
  );
}

/** A past fixture is scheduled beforehand; production still rejects retroactive substitution. */
export async function seedSessionSubstitute(
  database: TransactionClient,
  session: RecordSession,
  admin: StaffUser,
  teachers: readonly StaffUser[],
): Promise<StaffUser | null> {
  const date = isoOf(session.date);
  for (const teacher of teachers) {
    if (teacher.id === session.usualTeacherId || teacher.id === session.class.teacherId) continue;
    try {
      await assertTeacherEligible({ database, teacherId: teacher.id, date });
      await assertNoTeacherConflict({
        database,
        teacherId: teacher.id,
        from: date,
        through: date,
        slots: [],
        candidateMeetings: [
          {
            date,
            startTime: session.startTime.toISOString().slice(11, 16),
            endTime: session.endTime.toISOString().slice(11, 16),
          },
        ],
        excludeMeeting: {
          classId: session.classId,
          slotId: session.scheduleSlotId,
          sessionId: session.id,
          date,
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "BAD_REQUEST") continue;
      throw error;
    }
    const recordedAt = sessionEndInstant({ date: addDays(session.date, -1), endTime: "15:00" });
    const id = stableUuid(["class-record-substitution", session.id]);
    await database.classSubstitution.create({
      data: {
        id,
        classId: session.classId,
        scheduleSlotId: session.scheduleSlotId,
        classSessionId: session.scheduleSlotId ? null : session.id,
        date: session.date,
        teacherId: teacher.id,
        recordedById: admin.id,
        recordedAt,
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
    });
    await recordActivity(database, { staffUser: admin, now: recordedAt }, "teachers.substitute", {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description: `${teacher.name} ficou responsável pelo encontro de ${date.split("-").reverse().join("/")}.`,
      deduplicationKey: `seed-class-record-substitution/${id}`,
    });
    return teacher;
  }
  return null;
}
