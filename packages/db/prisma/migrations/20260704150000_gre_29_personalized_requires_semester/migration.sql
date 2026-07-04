-- Amended 2026-07-04 (GRE-27 doc review / GRE-29 alignment): PERSONALIZED classes also require
-- semester_id for session generation — same Semester window as REGULAR (D-0008, TECHNICAL_SPEC §4.4).

-- Backfill any PERSONALIZED rows still missing semester_id (dev/test leftovers) before tightening.
UPDATE "Class"
SET "semester_id" = (
  SELECT "id"
  FROM "Semester"
  WHERE "deleted_at" IS NULL
  ORDER BY "start_date" ASC
  LIMIT 1
)
WHERE "schedule_type" = 'PERSONALIZED'
  AND "semester_id" IS NULL
  AND EXISTS (SELECT 1 FROM "Semester" WHERE "deleted_at" IS NULL);

ALTER TABLE "Class" DROP CONSTRAINT "Class_regular_requires_semester_check";

ALTER TABLE "Class" ADD CONSTRAINT "Class_requires_semester_check"
CHECK ("semester_id" IS NOT NULL);

-- semester_id is mandatory for every class; do not null-out on semester delete.
ALTER TABLE "Class" DROP CONSTRAINT "Class_semester_id_fkey";

ALTER TABLE "Class" ADD CONSTRAINT "Class_semester_id_fkey"
FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
