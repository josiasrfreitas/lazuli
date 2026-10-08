import type { Prisma } from "@lazuli/db";
import { responsibilitySelect } from "./responsibility.js";

export const classSelect = {
  ...responsibilitySelect,
  id: true,
  status: true,
  internalCode: true,
  portalClassName: true,
  scheduleType: true,
  format: true,
  sharedStage: { select: { name: true } },
  semester: { select: { startDate: true, endDate: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    select: { id: true, weekday: true, startTime: true, endTime: true },
  },
} satisfies Prisma.ClassSelect;
const sessionSelect = {
  responsibilityFrozenAt: true,
  usualTeacherId: true,
  usualTeacher: { select: { id: true, name: true } },
  id: true,
  classId: true,
  scheduleSlotId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  deletedAt: true,
  attendanceConfirmedAt: true,
  attendanceLastCommittedAt: true,
  _count: { select: { attendanceRows: true } },
} satisfies Prisma.ClassSessionSelect;
const substitutionSelect = {
  id: true,
  revokedAt: true,
  coverageResolvedAt: true,
  classId: true,
  scheduleSlotId: true,
  classSessionId: true,
  date: true,
  teacherId: true,
  teacher: { select: { name: true, teacherProfile: { select: { departureDate: true } } } },
} satisfies Prisma.ClassSubstitutionSelect;
export type ScheduleClass = Prisma.ClassGetPayload<{ select: typeof classSelect }>;
export type ScheduleSession = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;
export type ScheduleSubstitution = Prisma.ClassSubstitutionGetPayload<{
  select: typeof substitutionSelect;
}>;
export type ScheduleData = {
  classes: ScheduleClass[];
  closedDays: { date: Date }[];
  sessions: ScheduleSession[];
  substitutions: ScheduleSubstitution[];
};
export async function loadScheduleData(
  database: Prisma.TransactionClient,
  range: { gte: Date; lte: Date },
): Promise<ScheduleData> {
  const [classes, closedDays, sessions, substitutions] = await Promise.all([
    database.class.findMany({
      where: {
        deletedAt: null,
        OR: [
          { semester: { startDate: { lte: range.lte }, endDate: { gte: range.gte } } },
          { sessions: { some: { date: range } } },
        ],
      },
      select: classSelect,
    }),
    database.schoolClosedDay.findMany({
      where: { deletedAt: null, date: range },
      select: { date: true },
    }),
    database.classSession.findMany({ where: { date: range }, select: sessionSelect }),
    database.classSubstitution.findMany({
      where: { date: range },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      select: substitutionSelect,
    }),
  ]);
  return { classes, closedDays, sessions, substitutions };
}
