import { currentTeacherClassesWhere, currentEnrollmentWhere } from "./read.js";
import type { Prisma } from "@lazuli/db";
import { responsibilitySelect } from "./responsibility.js";
import type { MetricGroup, MetricOccurrence } from "./metrics-types.js";
const gradeSelect = {
  id: true,
  score: true,
  assessedOn: true,
  phase: true,
  competence: true,
} as const;
export async function readMetricGroups(
  database: Prisma.TransactionClient,
  input: { teacherId: string; today: Date },
): Promise<MetricGroup[]> {
  const { today } = input;
  return database.class.findMany({
    where: currentTeacherClassesWhere([input.teacherId], today),
    select: {
      ...responsibilitySelect,
      id: true,
      portalClassName: true,
      scheduleType: true,
      sharedStage: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      semester: { select: { startDate: true, endDate: true, name: true } },
      enrollments: {
        where: { ...currentEnrollmentWhere(today), student: { deletedAt: null } },
        select: {
          id: true,
          classId: true,
          studentId: true,
          entryDate: true,
          exitDate: true,
          student: { select: { fullName: true } },
          progressRecords: {
            where: { deletedAt: null, startDate: { lte: today } },
            select: {
              startDate: true,
              endDate: true,
              stage: { select: { id: true, name: true } },
              assessment: {
                select: {
                  id: true,
                  deletedAt: true,
                  grades: {
                    where: { deletedAt: null, assessedOn: { lte: today } },
                    select: gradeSelect,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
export async function readMetricOccurrences(
  database: Prisma.TransactionClient,
  input: { students: Map<string, string>; classes: MetricGroup[]; from: Date; today: Date },
): Promise<MetricOccurrence[]> {
  const { students, classes, from, today } = input;
  return students.size > 0
    ? await database.pedagogicalOccurrence.findMany({
        where: {
          deletedAt: null,
          studentId: { in: [...students.keys()] },
          OR: [
            {
              classSession: {
                deletedAt: null,
                classId: { in: classes.map((row) => row.id) },
                date: { gte: from, lte: today },
              },
            },
            { classSessionId: null, occurredOn: { gte: from, lte: today } },
          ],
        },
        select: {
          id: true,
          studentId: true,
          title: true,
          account: true,
          initialResponse: true,
          category: true,
          recordedBy: { select: { name: true } },
          status: true,
          occurredOn: true,
          classSession: { select: { date: true } },
          interventions: {
            where: {
              deletedAt: null,
              intervention: { deletedAt: null, performedOn: { lte: today } },
            },
            select: { intervention: { select: { studentId: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
}
