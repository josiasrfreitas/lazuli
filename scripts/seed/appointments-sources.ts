import { classRecordSnapshotSchema } from "../../packages/validators/src/class-records.js";
import { stableUuid, utcDate, endOfDayUtc } from "../../packages/db/src/seed-dev-support.js";
import { saoPauloDateOnly } from "../../packages/domain/src/session-time.js";
import { DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import {
  scenarioDate,
  type AppointmentEnrollment,
  type AppointmentSeedContext,
  type SeedAbsence,
} from "./appointments-data.js";

const ABSENCE_SELECT = {
  id: true,
  enrollmentId: true,
  enrollment: { select: { studentId: true } },
  classSession: {
    select: {
      date: true,
      startTime: true,
      endTime: true,
      attendanceConfirmedAt: true,
      classRecord: { select: { snapshot: true } },
    },
  },
} as const;

export async function scenarioEnrollment(
  context: AppointmentSeedContext,
  index: number,
): Promise<AppointmentEnrollment | null> {
  const student = DEV_STUDENTS[index];
  const membership = student?.enrollments[0];
  if (!student || !membership) return null;
  return context.database.enrollment.findFirst({
    where: {
      id: stableUuid(["enrollment", student.key, membership.classKey]),
      deletedAt: null,
      student: { deletedAt: null },
    },
    select: {
      id: true,
      studentId: true,
      entryDate: true,
      exitDate: true,
      student: { select: { fullName: true, guardianId: true } },
      class: { select: { id: true, teacherId: true, format: true, scheduleType: true } },
    },
  });
}

/** Select only current ABSENT facts; no declaration, plan or free-form reason creates an origin. */
export async function scenarioAbsences(
  context: AppointmentSeedContext,
  enrollment: AppointmentEnrollment,
  daysBeforeToday = 8,
): Promise<SeedAbsence[]> {
  const rows = await context.database.attendance.findMany({
    where: {
      enrollmentId: enrollment.id,
      deletedAt: null,
      status: "ABSENT",
      classSession: {
        deletedAt: null,
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        date: {
          gte: enrollment.entryDate,
          lte: scenarioDate(context.todayIso, -daysBeforeToday),
          ...(enrollment.exitDate ? { lt: enrollment.exitDate } : {}),
        },
      },
    },
    select: ABSENCE_SELECT,
    orderBy: [{ classSession: { date: "desc" } }, { id: "asc" }],
  });
  const sources: SeedAbsence[] = [];
  for (const row of rows) {
    const allocated = await context.database.makeupCoverage.aggregate({
      where: {
        attendanceId: row.id,
        deletedAt: null,
        appointment: {
          deletedAt: null,
          status: { in: ["SCHEDULED", "ATTENDED"] },
        },
      },
      _sum: { minutes: true },
    });
    const minutes =
      (row.classSession.endTime.getTime() - row.classSession.startTime.getTime()) / 60_000;
    if ((allocated._sum.minutes ?? 0) !== 0) continue;
    const parsed = row.classSession.classRecord
      ? classRecordSnapshotSchema.safeParse(row.classSession.classRecord.snapshot)
      : null;
    sources.push({
      id: row.id,
      enrollmentId: row.enrollmentId,
      studentId: row.enrollment.studentId,
      date: row.classSession.date,
      confirmedAt: row.classSession.attendanceConfirmedAt!,
      minutes,
      sourceContent: parsed?.success ? (parsed.data.sharedContent?.account ?? null) : null,
    });
  }
  return sources;
}

/** Replays the baseline's date/target/identity choices, without parsing its prose. */
export async function knownLegacySource(
  context: AppointmentSeedContext,
  makeup: {
    id: string;
    originEnrollmentId: string;
    targetClassSessionId: string;
    scheduledAt: Date;
    attendedAt: Date | null;
  },
): Promise<SeedAbsence | null> {
  const date = saoPauloDateOnly(makeup.scheduledAt);
  if (makeup.scheduledAt.getTime() !== endOfDayUtc(date).getTime()) return null;
  const rows = await context.database.attendance.findMany({
    where: {
      enrollmentId: makeup.originEnrollmentId,
      status: "ABSENT",
      deletedAt: null,
      enrollment: { classId: stableUuid(["class", "E1A"]), deletedAt: null },
      classSession: {
        date: utcDate(date),
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        deletedAt: null,
      },
    },
    select: ABSENCE_SELECT,
  });
  if (rows.length !== 1) return null;
  const target = await context.database.classSession.findFirst({
    where: {
      classId: stableUuid(["class", "E1B"]),
      status: "SCHEDULED",
      deletedAt: null,
      date: makeup.attendedAt
        ? { gt: utcDate(date), lt: utcDate(context.todayIso) }
        : { gt: utcDate(context.todayIso) },
    },
    orderBy: { date: "asc" },
    select: { id: true },
  });
  if (
    target?.id !== makeup.targetClassSessionId ||
    makeup.id !== stableUuid(["makeup", makeup.originEnrollmentId, makeup.targetClassSessionId])
  )
    return null;
  const row = rows[0]!;
  const parsed = row.classSession.classRecord
    ? classRecordSnapshotSchema.safeParse(row.classSession.classRecord.snapshot)
    : null;
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    studentId: row.enrollment.studentId,
    date: row.classSession.date,
    confirmedAt: row.classSession.attendanceConfirmedAt!,
    minutes: (row.classSession.endTime.getTime() - row.classSession.startTime.getTime()) / 60_000,
    sourceContent: parsed?.success ? (parsed.data.sharedContent?.account ?? null) : null,
  };
}
