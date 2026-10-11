ALTER TABLE "AdmissionCandidate"
  ALTER COLUMN "schedule_type" DROP NOT NULL,
  ALTER COLUMN "format" DROP NOT NULL,
  ALTER COLUMN "available_until" DROP NOT NULL,
  ALTER COLUMN "availability_confirmed_at" DROP NOT NULL,
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "owner_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "next_action" TEXT,
  ADD COLUMN "next_action_on" DATE,
  ADD CONSTRAINT "AdmissionCandidate_next_action_check" CHECK ((next_action IS NULL) = (next_action_on IS NULL));
CREATE TABLE "LeadContact" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "candidate_id" UUID NOT NULL REFERENCES "AdmissionCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "contacted_on" DATE NOT NULL,
  "summary" TEXT NOT NULL,
  "recorded_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeadContact_candidate_id_contacted_on_idx" ON "LeadContact"("candidate_id", "contacted_on");
