CREATE TYPE "AcademicCompetence" AS ENUM ('ORAL', 'LISTENING', 'WRITTEN', 'PARTICIPATION');
CREATE TYPE "AssessmentPhase" AS ENUM ('BLOCK_ONE', 'BLOCK_TWO', 'RECOVERY');
CREATE TYPE "AcademicDecision" AS ENUM ('APPROVED', 'REPEAT');
CREATE TABLE "StageAssessment" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "student_id" UUID NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stage_id" UUID NOT NULL REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "started_on" DATE NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "decision" "AcademicDecision",
  "decision_reason" TEXT,
  "confirmed_at" TIMESTAMPTZ,
  "confirmed_by_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StageAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StageAssessment_confirmation_check" CHECK ((decision IS NULL AND confirmed_at IS NULL AND confirmed_by_id IS NULL) OR (decision IS NOT NULL AND confirmed_at IS NOT NULL AND confirmed_by_id IS NOT NULL))
);
CREATE INDEX "StageAssessment_student_id_started_on_idx" ON "StageAssessment"("student_id", "started_on");
CREATE INDEX "StageAssessment_stage_id_idx" ON "StageAssessment"("stage_id");
CREATE TABLE "AssessmentGrade" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "assessment_id" UUID NOT NULL REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "phase" "AssessmentPhase" NOT NULL,
  "competence" "AcademicCompetence" NOT NULL,
  "score" DECIMAL(4,1) NOT NULL CHECK (score >= 0 AND score <= 100),
  "assessed_on" DATE NOT NULL,
  "reason" TEXT,
  "recorded_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentGrade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentGrade_assessment_id_phase_competence_key" ON "AssessmentGrade"("assessment_id", "phase", "competence");
CREATE INDEX "AssessmentGrade_recorded_by_id_idx" ON "AssessmentGrade"("recorded_by_id");
ALTER TABLE "PedagogicalProgress" ADD COLUMN "assessment_id" UUID REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
