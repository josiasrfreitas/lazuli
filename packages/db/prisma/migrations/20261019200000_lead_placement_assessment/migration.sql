ALTER TYPE "EntryVisitKind" ADD VALUE 'PLACEMENT';

ALTER TABLE "AdmissionCandidate"
  ADD COLUMN "contact_role" TEXT NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "contact_owner" TEXT NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "birth_date" DATE,
  ADD COLUMN "english_experience" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD CONSTRAINT "AdmissionCandidate_contact_role_check" CHECK (contact_role IN ('STUDENT', 'GUARDIAN')),
  ADD CONSTRAINT "AdmissionCandidate_contact_owner_check" CHECK (contact_owner IN ('STUDENT', 'GUARDIAN')),
  ADD CONSTRAINT "AdmissionCandidate_english_experience_check" CHECK (english_experience IN ('NONE', 'SOME', 'UNKNOWN'));

-- Cast to text because a newly added enum value cannot be used until transaction commit.
ALTER TABLE "EntryVisit" DROP CONSTRAINT "EntryVisit_kind_check";
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_kind_check" CHECK (
  (kind::text = 'TRIAL' AND class_id IS NOT NULL AND (schedule_slot_id IS NOT NULL OR class_session_id IS NOT NULL)) OR
  (kind::text = 'INTRODUCTION' AND teacher_id IS NOT NULL AND class_id IS NULL AND schedule_slot_id IS NULL AND class_session_id IS NULL) OR
  (kind::text = 'PLACEMENT' AND teacher_id IS NULL AND class_id IS NULL AND schedule_slot_id IS NULL AND class_session_id IS NULL)
);

CREATE TABLE "EntryVisitAssessment" (
  "visit_id" UUID PRIMARY KEY REFERENCES "EntryVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "byte_length" INTEGER NOT NULL CHECK (byte_length > 0),
  "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stage_id" UUID REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "corrected_at" TIMESTAMPTZ,
  "corrected_by_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "notes" TEXT,
  CONSTRAINT "EntryVisitAssessment_result_check" CHECK (
    (stage_id IS NULL AND corrected_at IS NULL AND corrected_by_id IS NULL) OR
    (stage_id IS NOT NULL AND corrected_at IS NOT NULL AND corrected_by_id IS NOT NULL)
  )
);
