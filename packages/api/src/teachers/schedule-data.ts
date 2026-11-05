import { weekdayOf } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { responsibilitySelect } from "./responsibility.js";
import { loadTeacherIdentities } from "./identity-data.js";

export const classSelect = {
  ...responsibilitySelect,
  id: true,
  status: true,
  internalCode: true,
  portalClassName: true,
  scheduleType: true,
  format: true,
  startDate: true,
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
type ScheduleRange = { gte: Date; lte: Date };
type LoadedScheduleData = {
  classes: Array<
    Omit<ScheduleClass, "teacher" | "teacherAssignments"> & {
      teacherAssignments: Array<Omit<ScheduleClass["teacherAssignments"][number], "teacher">>;
    }
  >;
  closedDays: ScheduleData["closedDays"];
  sessions: Array<Omit<ScheduleSession, "usualTeacher">>;
  substitutions: Array<Omit<ScheduleSubstitution, "teacher">>;
};
const ISO_DATE_LENGTH = 10;
function scheduleClassWhere(range: ScheduleRange): Prisma.ClassWhereInput {
  return {
    deletedAt: null,
    // A day preview cannot produce a meeting without a matching slot or stored session.
    ...(range.gte.getTime() === range.lte.getTime()
      ? {
          AND: [
            {
              OR: [
                {
                  scheduleSlots: {
                    some: {
                      deletedAt: null,
                      weekday: weekdayOf(range.gte.toISOString().slice(0, ISO_DATE_LENGTH)),
                    },
                  },
                },
                { sessions: { some: { date: range } } },
              ],
            },
          ],
        }
      : {}),
    OR: [
      { semester: { startDate: { lte: range.lte }, endDate: { gte: range.gte } } },
      { sessions: { some: { date: range } } },
    ],
  };
}
async function hydrateScheduleTeachers(
  database: Prisma.TransactionClient,
  { classes, closedDays, sessions, substitutions }: LoadedScheduleData,
): Promise<ScheduleData> {
  const teachers = await loadTeacherIdentities(database, [
    ...classes.flatMap((row) => [
      row.teacherId,
      ...row.teacherAssignments.map((item) => item.teacherId),
    ]),
    ...sessions.map((row) => row.usualTeacherId),
    ...substitutions.map((row) => row.teacherId),
  ]);
  return {
    classes: classes.map((row) => ({
      ...row,
      teacher: teachers.get(row.teacherId)!,
      teacherAssignments: row.teacherAssignments.map((assignment) => ({
        ...assignment,
        teacher: teachers.get(assignment.teacherId)!,
      })),
    })),
    closedDays,
    sessions: sessions.map((row) => ({
      ...row,
      usualTeacher: row.usualTeacherId ? teachers.get(row.usualTeacherId)! : null,
    })),
    substitutions: substitutions.map((row) => ({ ...row, teacher: teachers.get(row.teacherId)! })),
  };
}
export async function loadScheduleData(
  database: Prisma.TransactionClient,
  range: { gte: Date; lte: Date },
): Promise<ScheduleData> {
  const [classes, closedDays, sessions, substitutions] = await Promise.all([
    database.class.findMany({
      where: scheduleClassWhere(range),
      select: {
        ...classSelect,
        teacher: false,
        teacherAssignments: {
          ...responsibilitySelect.teacherAssignments,
          select: { id: true, effectiveDate: true, teacherId: true },
        },
      },
    }),
    database.schoolClosedDay.findMany({
      where: { deletedAt: null, date: range },
      select: { date: true },
    }),
    database.classSession.findMany({
      where: { date: range },
      select: { ...sessionSelect, usualTeacher: false },
    }),
    database.classSubstitution.findMany({
      where: { date: range },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      select: { ...substitutionSelect, teacher: false },
    }),
  ]);
  return hydrateScheduleTeachers(database, { classes, closedDays, sessions, substitutions });
}
