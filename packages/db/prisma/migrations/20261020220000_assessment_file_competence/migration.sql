ALTER TABLE "AssessmentFile"
  ADD COLUMN "competence" "AcademicCompetence";

ALTER TABLE "AssessmentFile"
  ADD CONSTRAINT "AssessmentFile_written_competence_check"
  CHECK ("competence" IS NULL OR "competence" IN ('WRITTEN', 'LISTENING'));
