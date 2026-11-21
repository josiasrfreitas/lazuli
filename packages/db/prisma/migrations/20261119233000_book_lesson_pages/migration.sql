BEGIN;

CREATE TABLE "BookLessonPart" (
    "id" UUID PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "lesson_id" UUID NOT NULL REFERENCES "BookLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
    "title" TEXT NOT NULL CHECK (length(btrim("title")) BETWEEN 1 AND 80),
    UNIQUE ("lesson_id", "sequence"),
    UNIQUE ("lesson_id", "id")
);
CREATE UNIQUE INDEX "BookLessonPart_active_title_key"
    ON "BookLessonPart" ("lesson_id", lower(btrim("title"))) WHERE "deleted_at" IS NULL;

CREATE TABLE "BookLessonPage" (
    "id" UUID PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "part_id" UUID NOT NULL REFERENCES "BookLessonPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "number" INTEGER NOT NULL CHECK ("number" > 0),
    UNIQUE ("part_id", "id")
);
CREATE UNIQUE INDEX "BookLessonPage_active_number_key"
    ON "BookLessonPage" ("part_id", "number") WHERE "deleted_at" IS NULL;

CREATE TABLE "BookPageActivity" (
    "id" UUID PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "page_id" UUID NOT NULL REFERENCES "BookLessonPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
    "title" TEXT NOT NULL CHECK (length(btrim("title")) BETWEEN 1 AND 180),
    UNIQUE ("page_id", "sequence"),
    UNIQUE ("page_id", "id")
);

ALTER TABLE "ProgramActivityLesson"
    ADD COLUMN "part_id" UUID,
    ADD COLUMN "page_id" UUID,
    ADD COLUMN "page_activity_id" UUID,
    ADD FOREIGN KEY ("lesson_id", "part_id") REFERENCES "BookLessonPart"("lesson_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD FOREIGN KEY ("part_id", "page_id") REFERENCES "BookLessonPage"("part_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD FOREIGN KEY ("page_id", "page_activity_id") REFERENCES "BookPageActivity"("page_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CHECK (("part_id" IS NULL OR "part" = '')
        AND ("page_id" IS NULL OR "part_id" IS NOT NULL)
        AND ("page_activity_id" IS NULL OR "page_id" IS NOT NULL));

-- A shorter selection is itself a reference. Repeated NULLs must compare equal.
CREATE UNIQUE INDEX "ProgramActivityLesson_reference_key"
    ON "ProgramActivityLesson" ("activity_id", "lesson_id", "part", "part_id", "page_id", "page_activity_id")
    NULLS NOT DISTINCT;
DROP INDEX "ProgramActivityLesson_activity_id_lesson_id_part_key";

COMMIT;
