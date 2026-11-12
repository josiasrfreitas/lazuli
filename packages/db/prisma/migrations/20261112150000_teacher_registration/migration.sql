ALTER TABLE "TeacherProfile"
ADD COLUMN "employment_type" VARCHAR(20),
ADD COLUMN "weekly_hours" DOUBLE PRECISION,
ADD COLUMN "notes" TEXT,
ADD COLUMN "vacation_start" DATE,
ADD COLUMN "vacation_end" DATE,
ADD CONSTRAINT "teacher_weekly_hours_check" CHECK ("weekly_hours" > 0 AND "weekly_hours" <= 168),
ADD CONSTRAINT "teacher_employment_check" CHECK ("employment_type" IN ('CLT', 'PJ', 'AUTONOMOUS', 'OTHER')),
ADD CONSTRAINT "teacher_vacation_check" CHECK (
  ("vacation_start" IS NULL AND "vacation_end" IS NULL) OR
  ("employment_type" IS NOT NULL AND "employment_type" = 'CLT' AND "vacation_start" IS NOT NULL AND "vacation_end" IS NOT NULL AND "vacation_end" >= "vacation_start")
);
CREATE TABLE "TeacherFile" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "teacher_id" UUID NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_length" INTEGER NOT NULL,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  CONSTRAINT "TeacherFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeacherFile_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "TeacherProfile"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeacherFile_key_key" ON "TeacherFile"("key");
CREATE INDEX "TeacherFile_teacher_id_deleted_at_idx" ON "TeacherFile"("teacher_id", "deleted_at");
CREATE UNIQUE INDEX "teacher_active_photo" ON "TeacherFile"("teacher_id") WHERE "kind" = 'PHOTO' AND "deleted_at" IS NULL;
