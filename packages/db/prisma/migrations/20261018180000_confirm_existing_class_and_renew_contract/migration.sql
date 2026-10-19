ALTER TABLE "SemesterPlacement" DROP CONSTRAINT "SemesterPlacement_publication_check";
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_publication_check"
  CHECK ("published_at" IS NULL OR (
    "plan_id" IS NOT NULL AND "stage_id" IS NOT NULL AND "published_by_id" IS NOT NULL AND "enrollment_id" IS NOT NULL
    AND (("entry_action_id" IS NOT NULL AND "availability_id" IS NOT NULL)
      OR ("mode" = 'CONTINUE' AND "source_enrollment_id" IS NOT NULL AND "source_enrollment_id" = "enrollment_id" AND "entry_action_id" IS NULL AND "source_exit_action_id" IS NULL))
  ));
ALTER TABLE "Contract" ADD COLUMN "renewed_from_id" uuid REFERENCES "Contract"("id") ON DELETE RESTRICT;
CREATE INDEX "Contract_renewed_from_id_idx" ON "Contract" ("renewed_from_id");
