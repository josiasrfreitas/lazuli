ALTER TABLE "SemesterPlacement"
  ADD COLUMN "continuity" TEXT NOT NULL DEFAULT 'UNDECIDED',
  ADD COLUMN "continuity_reason" TEXT,
  ADD CONSTRAINT "SemesterPlacement_continuity_check"
    CHECK ("continuity" IN ('UNDECIDED', 'STAY', 'CHANGE', 'LEAVING'));

ALTER TABLE "SemesterClassPlan" ADD COLUMN "closed_at" TIMESTAMPTZ;

ALTER TABLE "AdmissionCandidate"
  ADD COLUMN "allocation_pending_at" TIMESTAMPTZ,
  ADD COLUMN "allocation_pending_reason" TEXT,
  ADD COLUMN "allocation_plan_id" UUID,
  ADD CONSTRAINT "AdmissionCandidate_allocation_plan_id_fkey"
    FOREIGN KEY ("allocation_plan_id") REFERENCES "SemesterClassPlan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AdmissionCandidate_allocation_pending_at_idx"
  ON "AdmissionCandidate" ("allocation_pending_at")
  WHERE "deleted_at" IS NULL AND "status" = 'WAITING';
