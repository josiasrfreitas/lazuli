-- Follow-up for environments that applied the first GRE-29 migration with a CHECK
-- constraint but left semester_id nullable (Prisma schema expects NOT NULL).

UPDATE "Class"
SET "semester_id" = (
  SELECT "id"
  FROM "Semester"
  WHERE "deleted_at" IS NULL
  ORDER BY "start_date" ASC
  LIMIT 1
)
WHERE "semester_id" IS NULL
  AND EXISTS (SELECT 1 FROM "Semester" WHERE "deleted_at" IS NULL);

ALTER TABLE "Class" DROP CONSTRAINT IF EXISTS "Class_requires_semester_check";

ALTER TABLE "Class" ALTER COLUMN "semester_id" SET NOT NULL;
