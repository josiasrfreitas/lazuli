import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import type { AssessmentSave } from "@lazuli/validators";
import {
  createPersonalizedClassFor,
  createStudentFor,
  ensureTeacherFor,
  seedTwoStageCatalogFor,
  ENROLLMENT_ADMIN_ID,
  type EnrollmentSuiteConfig,
} from "./enrollment/fixtures.js";

export const assessmentConfig: EnrollmentSuiteConfig = {
  prefix: "Assessment 175 ",
  catalogKey: "assessment175_line",
  catalogKeyPrefix: "assessment175_",
  teacherId: "00000000-0000-0000-0000-000000000175",
  teacherEmail: "assessment175@example.com",
  teacherName: "Assessment Teacher",
  semesterName: "Assessment 175 2073.1",
  semesterStart: "2073-02-01",
  semesterEnd: "2073-06-30",
};
export const ASSESSMENT_DATE = "2073-02-15";
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  role: "ADMIN",
  name: "Assessment Admin",
  email: "assessment-admin@example.com",
  isEnabled: true,
};
export const assessmentTeacher: StaffUser = {
  id: assessmentConfig.teacherId,
  role: "TEACHER",
  name: assessmentConfig.teacherName,
  email: assessmentConfig.teacherEmail,
  isEnabled: true,
};
export function assessmentCaller(
  date = ASSESSMENT_DATE,
  staffUser = admin,
): ReturnType<typeof createCaller> {
  return createCaller({ db, staffUser, now: new Date(`${date}T15:00:00Z`) });
}
export async function assessmentFixture(): Promise<{
  studentId: string;
  classId: string;
  semesterId: string;
  stageId: string;
  nextStageId: string;
  enrollmentId: string;
  progressId: string;
}> {
  await ensureTeacherFor(assessmentConfig);
  const catalog = await seedTwoStageCatalogFor(assessmentConfig);
  const classRow = await createPersonalizedClassFor(assessmentConfig, {
    code: "source",
    semesterId: catalog.semesterId,
  });
  const student = await createStudentFor(assessmentConfig, { suffix: "Student" });
  const created = await assessmentCaller().enrollment.create({
    studentId: student.id,
    classId: classRow.id,
    stageId: catalog.firstStageId,
  });
  return {
    studentId: student.id,
    classId: classRow.id,
    semesterId: catalog.semesterId,
    stageId: catalog.firstStageId,
    nextStageId: catalog.secondStageId,
    enrollmentId: created.enrollment.id,
    progressId: created.progress.id,
  };
}
export function completeGrades(oral = 60): AssessmentSave["grades"] {
  return (["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"] as const).flatMap((competence) =>
    (["BLOCK_ONE", "BLOCK_TWO"] as const).map((phase) => ({
      competence,
      phase,
      score: competence === "ORAL" ? oral : 100,
      assessedOn: ASSESSMENT_DATE,
      reason: null,
    })),
  );
}

/** Given an actual completed, coordinator-confirmed assessment before exercising stage movement. */
export async function approveProgress(
  caller: ReturnType<typeof createCaller>,
  { progressId, assessedOn }: { progressId: string; assessedOn: string },
): Promise<void> {
  const saved = await caller.assessments.save({
    progressId,
    version: 0,
    grades: completeGrades().map((grade) => ({ ...grade, assessedOn })),
  });
  await caller.assessments.confirm({
    progressId,
    version: saved.version,
    decision: "APPROVED",
    reason: "Competências concluídas antes do avanço de estágio.",
  });
}
