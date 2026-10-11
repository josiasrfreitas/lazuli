import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, type AttendancePercent } from "@lazuli/domain";
import type { Context } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { computeEnrollmentPercentInWindow } from "../attendance/percent.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { toDateOnlyString } from "./date-rules.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";

const enrollmentInclude = {
  class: {
    select: {
      id: true,
      portalClassName: true,
      format: true,
      scheduleType: true,
      ...responsibilitySelect,
      semester: true,
      scheduleSlots: { where: { deletedAt: null } },
    },
  },
  progressRecords: {
    where: { deletedAt: null },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
    include: { stage: { include: { track: true } } },
  },
} satisfies Prisma.EnrollmentInclude;
type Enrollment = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;
type EnrollmentView = {
  id: string;
  entryDate: string;
  exitDate: string | null;
  exitReason: Enrollment["exitReason"];
  current: boolean;
  class: {
    id: string;
    name: string;
    format: Enrollment["class"]["format"];
    scheduleType: Enrollment["class"]["scheduleType"];
    semester: string;
    teacher: { id: string; name: string } | null;
    schedule: Array<{
      id: string;
      weekday: Enrollment["class"]["scheduleSlots"][number]["weekday"];
      startTime: string;
      endTime: string;
    }>;
  };
  progress: Array<{
    id: string;
    stage: string;
    track: string;
    startDate: string;
    endDate: string | null;
    endReason: Enrollment["progressRecords"][number]["endReason"];
  }>;
};
type Input = { database: Context["db"]; id: string; now: Date };
const TIME_START = 11;
const TIME_END = 16;

export async function readStudentPedagogy(input: Input): Promise<{
  today: string;
  enrollments: Array<ReturnType<typeof enrollmentView> & { attendance: AttendancePercent }>;
}> {
  const student = await input.database.student.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const enrollments = await input.database.enrollment.findMany({
    where: { studentId: input.id, deletedAt: null, class: { deletedAt: null } },
    orderBy: [{ entryDate: "desc" }, { id: "asc" }],
    include: enrollmentInclude,
  });
  const today = saoPauloDateOnly(input.now);
  return {
    today,
    enrollments: await Promise.all(
      enrollments.map(async (enrollment) => ({
        ...enrollmentView(enrollment, today),
        attendance: await computeEnrollmentPercentInWindow({
          database: input.database,
          values: { enrollment, semester: enrollment.class.semester },
        }),
      })),
    ),
  };
}

function enrollmentView(enrollment: Enrollment, today: string): EnrollmentView {
  const entryDate = toDateOnlyString(enrollment.entryDate);
  const exitDate = toDateOnlyString(enrollment.exitDate);
  return {
    id: enrollment.id,
    entryDate,
    exitDate,
    exitReason: enrollment.exitReason,
    current: entryDate <= today && (exitDate === null || exitDate > today),
    class: {
      id: enrollment.class.id,
      name: enrollment.class.portalClassName,
      format: enrollment.class.format,
      scheduleType: enrollment.class.scheduleType,
      semester: enrollment.class.semester.name,
      teacher: usualTeacherOn(
        enrollment.class,
        new Date(exitDate && exitDate < today ? exitDate : today),
      ),
      schedule: enrollment.class.scheduleSlots.map((slot) => ({
        id: slot.id,
        weekday: slot.weekday,
        startTime: slot.startTime.toISOString().slice(TIME_START, TIME_END),
        endTime: slot.endTime.toISOString().slice(TIME_START, TIME_END),
      })),
    },
    progress: enrollment.progressRecords.map((progress) => ({
      id: progress.id,
      stage: progress.stage.name,
      track: progress.stage.track.name,
      startDate: toDateOnlyString(progress.startDate),
      endDate: toDateOnlyString(progress.endDate),
      endReason: progress.endReason,
    })),
  };
}
