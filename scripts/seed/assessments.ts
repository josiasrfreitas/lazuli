import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import {
  addDays,
  endOfDayUtc,
  isoOf,
  requireValue,
  stableUuid,
} from "../../packages/db/src/seed-dev-support.js";
import {
  ACADEMIC_COMPETENCES,
  assessmentResults,
  assessmentStatus,
  type AcademicCompetence,
  type AcademicGrade,
  type AssessmentPhase,
} from "../../packages/domain/src/assessment.js";

const PROFILE_CYCLE = 10;
const PROFILE_STRIDE = 7;
const INCOMPLETE_LIMIT = 3;
const SUFFICIENT_LIMIT = 7;
const SUPPORT_LIMIT = 9;
const HISTORICAL_RECOVERY_CYCLE = 5;
const FAILED_RECOVERY_CYCLE = 3;
const CONFIRMATION_CYCLE = 7;
const CURRENT_BLOCK_ONE_DAYS = 28;
const CURRENT_BLOCK_TWO_DAYS = 63;
const HISTORICAL_BLOCK_ONE_DAYS = 14;
const HISTORICAL_BLOCK_TWO_DAYS = 28;
const CURRENT_DATE_SPREAD = 7;
const HISTORICAL_DATE_SPREAD = 4;
const CURRENT_RECOVERY_WAIT_DAYS = 10;
const HISTORICAL_RECOVERY_WAIT_DAYS = 7;
const HASH_LENGTH = 6;
const HEX_RADIX = 16;
const WEAK_SCORE_FLOOR = 42;
const WEAK_SCORE_SPREAD = 17;
const WEAK_SECOND_BLOCK_CEILING = 61;
const WEAK_IMPROVEMENT_SPREAD = 9;
const SUFFICIENT_SCORE_FLOOR = 65;
const SUFFICIENT_SCORE_SPREAD = 25;
const SUFFICIENT_SECOND_BLOCK_CEILING = 97;
const IMPROVEMENT_SPREAD = 15;
const DECLINE_OFFSET = 4;
const BOUNDARY_CYCLE = 19;
const BOUNDARY_FIRST_SCORE = 58;
const BOUNDARY_SECOND_SCORE = 62;
const RECOVERY_PASS_FLOOR = 60;
const RECOVERY_PASS_SPREAD = 27;
const RECOVERY_FAIL_FLOOR = 50;
const RECOVERY_FAIL_SPREAD = 10;
const SCHOOL_MIDNIGHT_UTC_HOUR = 3;
const CONFIRMATION_UTC_HOUR = 18;
const BLOCK_PHASES = ["BLOCK_ONE", "BLOCK_TWO"] as const;
const DIFFICULTY_COMPETENCES: readonly AcademicCompetence[] = [
  "ORAL",
  "LISTENING",
  "WRITTEN",
  "LISTENING",
  "ORAL",
  "WRITTEN",
  "PARTICIPATION",
];
const COMPETENCE_LABELS: Record<AcademicCompetence, string> = {
  ORAL: "expressão oral",
  LISTENING: "compreensão oral",
  WRITTEN: "produção escrita",
  PARTICIPATION: "participação",
};

type AssessmentProfile = "incomplete" | "sufficient" | "difficulty" | "recovery";
type SeedProgress = {
  id: string;
  enrollmentId: string;
  stageId: string;
  startDate: Date;
  endDate: Date | null;
  endReason: string | null;
  enrollment: { studentId: string; class: { teacherId: string | null } };
};
type AssessmentContext = {
  progress: SeedProgress;
  studentIndex: number;
  todayIso: string;
  adminId: string;
  presentDates: Date[];
  historical: boolean;
  profile: AssessmentProfile;
};
type SeedGrade = AcademicGrade & { assessedOn: Date; reason: string | null };
type Confirmation = {
  decision: "APPROVED" | "REPEAT" | null;
  decisionReason: string | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
};
const NO_CONFIRMATION: Confirmation = {
  decision: null,
  decisionReason: null,
  confirmedAt: null,
  confirmedById: null,
};

/** Fresh-school loader: assessments belong to student/stage, and progress references their identity. */
export async function seedAssessments(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const students = new Map(
    DEV_STUDENTS.map((student, index) => [stableUuid(["student", student.key]), index]),
  );
  const progress = await seedProgressRecords(database);
  assertRealAdvancement(progress);
  const presentDates = await studentPresentDates(
    database,
    progress.map((row) => row.enrollmentId),
  );
  for (const row of progress) {
    const studentIndex = requireValue(students.get(row.enrollment.studentId), "assessment student");
    const historical = row.endReason === "ADVANCED";
    await createAssessment(database, {
      progress: row,
      studentIndex,
      todayIso,
      adminId: admin.id,
      historical,
      presentDates: presentDates.get(row.enrollmentId) ?? [],
      profile: assessmentProfile({ studentIndex, historical }),
    });
  }
}

async function seedProgressRecords(database: DatabaseClient): Promise<SeedProgress[]> {
  const ids = DEV_STUDENTS.flatMap((student) =>
    student.enrollments.flatMap((enrollment) =>
      ["progress", "progress-history"].map((prefix) =>
        stableUuid([prefix, student.key, enrollment.classKey]),
      ),
    ),
  );
  return database.pedagogicalProgress.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      enrollmentId: true,
      stageId: true,
      startDate: true,
      endDate: true,
      endReason: true,
      enrollment: { select: { studentId: true, class: { select: { teacherId: true } } } },
    },
    orderBy: [{ enrollmentId: "asc" }, { startDate: "asc" }],
  });
}

function assertRealAdvancement(progress: readonly SeedProgress[]): void {
  for (const row of progress.filter((entry) => entry.endReason === "ADVANCED")) {
    const next = progress.find(
      (entry) => entry.enrollmentId === row.enrollmentId && entry.startDate > row.startDate,
    );
    if (!next || next.stageId === row.stageId) {
      throw new Error("Development advancement must lead to a different stage.");
    }
  }
}

async function studentPresentDates(
  database: DatabaseClient,
  enrollmentIds: string[],
): Promise<Map<string, Date[]>> {
  const attendance = await database.attendance.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      status: "PRESENT",
      classSession: { status: "SCHEDULED" },
    },
    select: { enrollmentId: true, classSession: { select: { date: true } } },
    orderBy: { classSession: { date: "asc" } },
  });
  const dates = new Map<string, Date[]>();
  for (const row of attendance) {
    const own = dates.get(row.enrollmentId) ?? [];
    own.push(row.classSession.date);
    dates.set(row.enrollmentId, own);
  }
  return dates;
}

function assessmentProfile(input: {
  studentIndex: number;
  historical: boolean;
}): AssessmentProfile {
  if (input.historical)
    return input.studentIndex % HISTORICAL_RECOVERY_CYCLE === 0 ? "recovery" : "sufficient";
  const position = (input.studentIndex * PROFILE_STRIDE) % PROFILE_CYCLE;
  if (position < INCOMPLETE_LIMIT) return "incomplete";
  if (position < SUFFICIENT_LIMIT) return "sufficient";
  return position < SUPPORT_LIMIT ? "difficulty" : "recovery";
}

async function createAssessment(
  database: DatabaseClient,
  context: AssessmentContext,
): Promise<void> {
  const { progress } = context;
  const grades = blockGrades(context);
  grades.push(...recoveryGrades(context, grades));
  const confirmation = assessmentConfirmation(context, grades);
  const id = stableUuid([
    "stage-assessment",
    progress.enrollment.studentId,
    progress.stageId,
    isoOf(progress.startDate),
  ]);
  await database.stageAssessment.create({
    data: {
      id,
      studentId: progress.enrollment.studentId,
      stageId: progress.stageId,
      startedOn: progress.startDate,
      version: 1,
      createdAt: schoolTimestamp(progress.startDate, SCHOOL_MIDNIGHT_UTC_HOUR),
      createdById: context.adminId,
      ...confirmation,
      progressRecords: { connect: { id: progress.id } },
      grades: {
        create: grades.map((grade) => ({
          ...grade,
          id: stableUuid(["assessment-grade", id, grade.phase, grade.competence]),
          recordedById: progress.enrollment.class.teacherId ?? context.adminId,
          createdAt: endOfDayUtc(isoOf(grade.assessedOn)),
        })),
      },
    },
  });
}

function blockGrades(context: AssessmentContext): SeedGrade[] {
  const grades: SeedGrade[] = [];
  for (const phase of BLOCK_PHASES) {
    for (const [index, competence] of ACADEMIC_COMPETENCES.entries()) {
      if (omitSecondBlock(context, { phase, competence })) continue;
      const assessedOn = blockDate(context, { phase, competenceIndex: index });
      if (!assessedOn) continue;
      grades.push({
        phase,
        competence,
        assessedOn,
        score: blockScore(context, { phase, competence }),
        reason: null,
      });
    }
  }
  return grades;
}

function omitSecondBlock(
  context: AssessmentContext,
  input: { phase: AssessmentPhase; competence: AcademicCompetence },
): boolean {
  if (context.profile !== "incomplete" || input.phase !== "BLOCK_TWO") return false;
  const variant = studentVariant(context);
  return variant % FAILED_RECOVERY_CYCLE === 0 || input.competence === primaryDifficulty(context);
}

function blockDate(
  context: AssessmentContext,
  input: { phase: AssessmentPhase; competenceIndex: number },
): Date | null {
  const first = context.historical ? HISTORICAL_BLOCK_ONE_DAYS : CURRENT_BLOCK_ONE_DAYS;
  const second = context.historical ? HISTORICAL_BLOCK_TWO_DAYS : CURRENT_BLOCK_TWO_DAYS;
  const spread = context.historical ? HISTORICAL_DATE_SPREAD : CURRENT_DATE_SPREAD;
  const offset =
    (input.phase === "BLOCK_ONE" ? first : second) +
    (studentVariant(context) % spread) +
    (input.competenceIndex % 2);
  return presentOnOrAfter(context, addDays(context.progress.startDate, offset));
}

function presentOnOrAfter(context: AssessmentContext, earliest: Date): Date | null {
  return (
    context.presentDates.find(
      (date) =>
        date >= earliest &&
        isoOf(date) < context.todayIso &&
        (context.progress.endDate === null || date <= context.progress.endDate),
    ) ?? null
  );
}

function studentVariant(context: AssessmentContext): number {
  return variation(["learning-profile", context.progress.enrollment.studentId]);
}

function variation(parts: string[]): number {
  return Number.parseInt(stableUuid(parts).slice(0, HASH_LENGTH), HEX_RADIX);
}

function primaryDifficulty(context: AssessmentContext): AcademicCompetence {
  return DIFFICULTY_COMPETENCES[studentVariant(context) % DIFFICULTY_COMPETENCES.length]!;
}

function weakCompetence(context: AssessmentContext, competence: AcademicCompetence): boolean {
  if (context.profile !== "difficulty" && context.profile !== "recovery") return false;
  const primary = primaryDifficulty(context);
  if (competence === primary) return true;
  const secondary =
    ACADEMIC_COMPETENCES[(ACADEMIC_COMPETENCES.indexOf(primary) + 1) % ACADEMIC_COMPETENCES.length];
  return studentVariant(context) % FAILED_RECOVERY_CYCLE === 0 && competence === secondary;
}

function blockScore(
  context: AssessmentContext,
  input: { phase: AssessmentPhase; competence: AcademicCompetence },
): number {
  const seed = variation([
    "grade",
    context.progress.enrollment.studentId,
    context.progress.stageId,
    input.competence,
  ]);
  if (weakCompetence(context, input.competence)) return weakBlockScore(seed, input.phase);
  if (seed % BOUNDARY_CYCLE === 0)
    return input.phase === "BLOCK_ONE" ? BOUNDARY_FIRST_SCORE : BOUNDARY_SECOND_SCORE;
  const base = SUFFICIENT_SCORE_FLOOR + (seed % SUFFICIENT_SCORE_SPREAD);
  const change = (Math.floor(seed / SUFFICIENT_SCORE_SPREAD) % IMPROVEMENT_SPREAD) - DECLINE_OFFSET;
  return input.phase === "BLOCK_ONE"
    ? base
    : Math.min(SUFFICIENT_SECOND_BLOCK_CEILING, base + change);
}

function weakBlockScore(seed: number, phase: AssessmentPhase): number {
  const first = WEAK_SCORE_FLOOR + (seed % WEAK_SCORE_SPREAD);
  if (phase === "BLOCK_ONE") return first;
  return Math.min(WEAK_SECOND_BLOCK_CEILING, first + 2 + (seed % WEAK_IMPROVEMENT_SPREAD));
}

function recoveryGrades(context: AssessmentContext, originals: readonly SeedGrade[]): SeedGrade[] {
  if (context.profile !== "recovery") return [];
  const recovery: SeedGrade[] = [];
  for (const competence of ACADEMIC_COMPETENCES) {
    if (!weakCompetence(context, competence)) continue;
    const first = originals.find(
      (grade) => grade.competence === competence && grade.phase === "BLOCK_ONE",
    );
    const second = originals.find(
      (grade) => grade.competence === competence && grade.phase === "BLOCK_TWO",
    );
    if (!first || !second) continue;
    const wait = context.historical ? HISTORICAL_RECOVERY_WAIT_DAYS : CURRENT_RECOVERY_WAIT_DAYS;
    const assessedOn = presentOnOrAfter(context, addDays(second.assessedOn, wait));
    if (!assessedOn) continue;
    recovery.push({
      phase: "RECOVERY",
      competence,
      assessedOn,
      score: recoveryScore(context, competence),
      reason: `Recuperação de ${COMPETENCE_LABELS[competence]} após revisão orientada e nova atividade individual.`,
    });
  }
  return recovery;
}

function recoveryScore(context: AssessmentContext, competence: AcademicCompetence): number {
  const seed = variation(["recovery", context.progress.enrollment.studentId, competence]);
  const passes =
    context.historical ||
    Math.floor(context.studentIndex / PROFILE_CYCLE) % FAILED_RECOVERY_CYCLE !== 0;
  return passes
    ? RECOVERY_PASS_FLOOR + (seed % RECOVERY_PASS_SPREAD)
    : RECOVERY_FAIL_FLOOR + (seed % RECOVERY_FAIL_SPREAD);
}

function assessmentConfirmation(
  context: AssessmentContext,
  grades: readonly SeedGrade[],
): Confirmation {
  const status = assessmentStatus(assessmentResults(grades));
  assertHistoricalEvidence(context, status);
  const selected =
    context.historical ||
    Math.floor(context.studentIndex / PROFILE_CYCLE) % CONFIRMATION_CYCLE === 0;
  if (!selected || status === "INCOMPLETE") return NO_CONFIRMATION;
  const confirmedAt = confirmationTimestamp(context, grades);
  if (confirmedAt === null) {
    if (context.historical)
      throw new Error("Advanced development stages require a prior pedagogical confirmation.");
    return NO_CONFIRMATION;
  }
  const passed = status === "SUFFICIENT";
  return {
    decision: passed ? "APPROVED" : "REPEAT",
    decisionReason: passed
      ? "Coordenação conferiu os dois blocos e as recuperações aplicáveis; desempenho suficiente em todas as competências."
      : "Coordenação revisou as evidências e confirmou repetição do estágio por competências ainda insuficientes.",
    confirmedAt,
    confirmedById: context.adminId,
  };
}

function assertHistoricalEvidence(
  context: AssessmentContext,
  status: ReturnType<typeof assessmentStatus>,
): void {
  if (context.historical && status !== "SUFFICIENT") {
    throw new Error("Advanced development stages require sufficient assessment evidence.");
  }
}

function confirmationTimestamp(
  context: AssessmentContext,
  grades: readonly SeedGrade[],
): Date | null {
  const latest = grades.reduce(
    (date, grade) => (grade.assessedOn > date ? grade.assessedOn : date),
    context.progress.startDate,
  );
  const date = addDays(latest, 1);
  if (isoOf(date) >= context.todayIso) return null;
  if (context.historical && context.progress.endDate && date > context.progress.endDate)
    return null;
  return schoolTimestamp(date, CONFIRMATION_UTC_HOUR);
}

function schoolTimestamp(date: Date, hour: number): Date {
  const timestamp = new Date(date);
  timestamp.setUTCHours(hour, 0, 0, 0);
  return timestamp;
}
