import type { Prisma } from "@lazuli/db";
import { effectiveTeacherId } from "@lazuli/domain";
const ISO_DATE_LENGTH = 10;

export const responsibilitySelect = {
  teacherId: true,
  teacher: {
    select: { id: true, name: true, teacherProfile: { select: { departureDate: true } } },
  },
  teacherAssignments: {
    where: { supersededAt: null },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      effectiveDate: true,
      teacherId: true,
      teacher: {
        select: { id: true, name: true, teacherProfile: { select: { departureDate: true } } },
      },
    },
  },
} satisfies Prisma.ClassSelect;
type Responsibility = Prisma.ClassGetPayload<{ select: typeof responsibilitySelect }>;
export function usualTeacherOn(
  row: Responsibility,
  date: Date,
): { id: string; name: string } | null {
  const teachers = [row.teacher, ...row.teacherAssignments.map((item) => item.teacher)];
  const id = effectiveTeacherId({
    initialTeacherId: row.teacherId,
    assignments: row.teacherAssignments.map((item) => ({
      teacherId: item.teacherId,
      effectiveDate: item.effectiveDate.toISOString().slice(0, ISO_DATE_LENGTH),
    })),
    departureDates: new Map(
      teachers.map((teacher) => [
        teacher.id,
        teacher.teacherProfile?.departureDate?.toISOString().slice(0, ISO_DATE_LENGTH) ?? null,
      ]),
    ),
    date: date.toISOString().slice(0, ISO_DATE_LENGTH),
  });
  const teacher = teachers.find((item) => item.id === id);
  return teacher ? { id: teacher.id, name: teacher.name } : null;
}

export function teacherResponsibilityPeriods(
  row: Responsibility,
  teacherId: string,
): Array<{ start: Date; end: Date | null }> {
  const assignments = [
    { effectiveDate: new Date("0001-01-01"), teacher: row.teacher },
    ...[...row.teacherAssignments].toSorted(
      (left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime(),
    ),
  ];
  return assignments.flatMap((assignment, index) => {
    if (assignment.teacher.id !== teacherId) return [];
    const next = assignments[index + 1]?.effectiveDate;
    const departure = assignment.teacher.teacherProfile?.departureDate;
    const end =
      next && departure
        ? new Date(Math.min(next.getTime(), departure.getTime()))
        : (next ?? departure ?? null);
    return end && end <= assignment.effectiveDate ? [] : [{ start: assignment.effectiveDate, end }];
  });
}
