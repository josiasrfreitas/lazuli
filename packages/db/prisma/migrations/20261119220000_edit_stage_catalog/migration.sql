BEGIN;
ALTER TABLE "Track" ADD COLUMN display_order SERIAL;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY name, id) AS position FROM "Track"
)
UPDATE "Track" SET display_order = ordered.position FROM ordered WHERE ordered.id = "Track".id;
ALTER TABLE "Stage" ADD COLUMN status "CatalogStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "ProgramActivity" ADD COLUMN page_start INTEGER, ADD COLUMN page_end INTEGER,
  ADD CONSTRAINT "program_activity_pages" CHECK (
    (page_start IS NULL AND page_end IS NULL) OR
    (page_start IS NOT NULL AND page_start > 0 AND (page_end IS NULL OR page_end >= page_start))
  );
COMMIT;
