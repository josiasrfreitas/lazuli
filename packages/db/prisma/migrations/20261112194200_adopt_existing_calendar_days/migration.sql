-- Preserve unknown legacy authors instead of attributing historical calendar dates to an operator.
ALTER TABLE "AcademicInterruption" ALTER COLUMN "created_by_id" DROP NOT NULL;

INSERT INTO "AcademicInterruption" (
  "id", "created_at", "updated_at", "from_date", "through_date", "kind", "title",
  "description", "source_key", "created_by_id"
)
SELECT gen_random_uuid(), "created_at", "updated_at", "date", "date", 'OTHER',
  CASE WHEN btrim("reason") = '' THEN 'Dia sem atividades acadêmicas' ELSE left("reason", 160) END,
  CASE WHEN length("reason") > 160 THEN "reason" ELSE NULL END,
  'legacy:' || "id"::text, "created_by_id"
FROM "SchoolClosedDay"
WHERE "deleted_at" IS NULL AND "calendar_managed" = false;

UPDATE "SchoolClosedDay" AS day SET "calendar_managed" = true
WHERE EXISTS (
  SELECT 1 FROM "AcademicInterruption" AS interruption
  WHERE interruption."source_key" = 'legacy:' || day."id"::text
);
