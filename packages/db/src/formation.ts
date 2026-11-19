import { assessmentResults, assessmentStatus, saoPauloDateOnly } from "@lazuli/domain";
import { computeEnrollmentsPercentInWindow } from "./attendance-percent.js";
import type { Prisma } from "./generated/prisma/client.js";
import type { TransactionClient } from "./client.js";

export const contractAt = (at: Date): Prisma.ContractWhereInput => ({
  deletedAt: null,
  terminatedAt: null,
  startsOn: { lte: at },
  endsOn: { gte: at },
});

export type FormationAcademics = {
  gradeAverage: number | null;
  gradesIncomplete: boolean;
  grades: "INCOMPLETE" | "SUFFICIENT" | "NEEDS_SUPPORT";
  attendance: number | null;
  attendanceFlagged: boolean;
};

export const emptyFormationAcademics: FormationAcademics = {
  gradeAverage: null,
  gradesIncomplete: true,
  grades: "INCOMPLETE",
  attendance: null,
  attendanceFlagged: false,
};

/** Evaluate each source attempt in its own period, including when the board is opened after the break. */
export async function readFormationAcademics(
  database: TransactionClient,
  { progressIds, now }: { progressIds: string[]; now: Date },
): Promise<Map<string, FormationAcademics>> {
  if (progressIds.length === 0) return new Map();
  const today = new Date(saoPauloDateOnly(now));
  const attempts = await database.pedagogicalProgress.findMany({
    where: { id: { in: progressIds }, deletedAt: null },
    select: {
      id: true,
      assessment: {
        select: {
          deletedAt: true,
          grades: {
            where: { deletedAt: null, assessedOn: { lte: today } },
            select: { phase: true, competence: true, score: true },
          },
        },
      },
      enrollment: {
        select: {
          id: true,
          classId: true,
          entryDate: true,
          exitDate: true,
          class: { select: { semester: { select: { id: true, startDate: true, endDate: true } } } },
        },
      },
    },
  });
  const groups = attemptsByPeriod(attempts);
  const result = new Map<string, FormationAcademics>();
  for (const group of groups.values()) {
    const period = group[0]!.enrollment.class.semester;
    const attendance = await computeEnrollmentsPercentInWindow({
      database,
      requireAttendanceRecord: true,
      values: {
        enrollments: group.map((row) => row.enrollment),
        semester: {
          startDate: period.startDate,
          endDate: period.endDate < today ? period.endDate : today,
        },
      },
    });
    for (const row of group) {
      const grades = row.assessment && !row.assessment.deletedAt ? row.assessment.grades : [];
      const results = assessmentResults(
        grades.map((grade) => ({ ...grade, score: Number(grade.score) })),
      );
      result.set(row.id, {
        ...gradeMetrics(results),
        ...presenceMetrics(attendance.get(row.enrollment.id)),
      });
    }
  }
  return result;
}

function gradeMetrics(
  results: ReturnType<typeof assessmentResults>,
): Pick<FormationAcademics, "gradesIncomplete" | "grades" | "gradeAverage"> {
  const effectiveScores = results.flatMap(({ effective }) =>
    effective === null ? [] : [effective],
  );
  return {
    gradesIncomplete: results.some((result) => result.effective === null),
    grades: results.some((result) => result.passed === false)
      ? "NEEDS_SUPPORT"
      : assessmentStatus(results),
    gradeAverage:
      effectiveScores.length > 0
        ? effectiveScores.reduce((sum, score) => sum + score, 0) / effectiveScores.length
        : null,
  };
}

function attemptsByPeriod<T extends { enrollment: { class: { semester: { id: string } } } }>(
  attempts: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const attempt of attempts) {
    const id = attempt.enrollment.class.semester.id;
    const group = groups.get(id);
    if (group) group.push(attempt);
    else groups.set(id, [attempt]);
  }
  return groups;
}
function presenceMetrics(
  presence: { percent: number | null; flagged: boolean } | undefined,
): Pick<FormationAcademics, "attendance" | "attendanceFlagged"> {
  return { attendance: presence?.percent ?? null, attendanceFlagged: presence?.flagged ?? false };
}
