import type { Prisma } from "@lazuli/db";
import { readStudentHealthBatch } from "@lazuli/db/student-health-batch";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";
import { mean } from "./metric-rules.js";
import { currentEnrollmentWhere, currentTeacherClassesWhere } from "./read.js";

export async function teacherListScores(
  database: Prisma.TransactionClient,
  { ids: teacherIds, now }: { ids: string[]; now: Date },
): Promise<Record<string, number | null>> {
  const today = new Date(saoPauloDateOnly(now));
  const groups = await database.class.findMany({
    where: currentTeacherClassesWhere(teacherIds, today),
    select: {
      ...responsibilitySelect,
      enrollments: {
        where: { ...currentEnrollmentWhere(today), student: { deletedAt: null } },
        select: { studentId: true },
      },
    },
  });
  const students = new Map(teacherIds.map((id) => [id, new Set<string>()]));
  for (const group of groups) {
    const teacher = usualTeacherOn(group, today);
    if (teacher) for (const row of group.enrollments) students.get(teacher.id)?.add(row.studentId);
  }
  const ids = [...new Set([...students.values()].flatMap((group) => [...group]))];
  const health = ids.length > 0 ? await readStudentHealthBatch({ database, ids, now }) : [];
  const scores = new Map(health.map((row) => [row.studentId, row.score]));
  return Object.fromEntries(
    [...students].map(([id, group]) => [
      id,
      mean([...group].map((student) => scores.get(student) ?? null)),
    ]),
  );
}
