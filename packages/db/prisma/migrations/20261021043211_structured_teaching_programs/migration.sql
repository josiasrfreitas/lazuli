-- CreateEnum
CREATE TYPE "TrackAgeGroup" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "ProgramActivityKind" AS ENUM ('LESSON', 'INTRODUCTION', 'REVIEW', 'ASSESSMENT', 'VIDEO', 'ACTIVITY');

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "book_lesson_count" INTEGER;

-- AlterTable
ALTER TABLE "StagePlanItem" ADD COLUMN     "program_activity_id" UUID;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "age_group" "TrackAgeGroup" NOT NULL DEFAULT 'ADULT';

-- CreateTable
CREATE TABLE "TeachingModality" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekly_minutes" INTEGER NOT NULL DEFAULT 120,

    CONSTRAINT "TeachingModality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookLesson" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "stage_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "BookLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingProgram" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "stage_id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "schedule_type" "ClassScheduleType" NOT NULL,
    "source_provider" TEXT NOT NULL,
    "source_reference" TEXT NOT NULL,
    "source_revision" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMPTZ,

    CONSTRAINT "TeachingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramUnit" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "program_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "ProgramUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingHour" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "program_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,

    CONSTRAINT "TeachingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramAssessment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "program_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "ProgramAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramActivity" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "program_id" UUID NOT NULL,
    "teaching_hour_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "assessment_id" UUID,
    "source_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "kind" "ProgramActivityKind" NOT NULL,
    "title" TEXT NOT NULL,
    "source_code" TEXT,
    "description_pending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProgramActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramActivityLesson" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "activity_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "part" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ProgramActivityLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeachingModality_code_key" ON "TeachingModality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BookLesson_stage_id_source_key_key" ON "BookLesson"("stage_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "BookLesson_stage_id_sequence_key" ON "BookLesson"("stage_id", "sequence");

-- CreateIndex
CREATE INDEX "TeachingProgram_stage_id_retired_at_idx" ON "TeachingProgram"("stage_id", "retired_at");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingProgram_stage_id_modality_id_schedule_type_source_p_key" ON "TeachingProgram"("stage_id", "modality_id", "schedule_type", "source_provider", "source_reference", "source_revision");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramUnit_program_id_source_key_key" ON "ProgramUnit"("program_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramUnit_program_id_sequence_key" ON "ProgramUnit"("program_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramUnit_program_id_id_key" ON "ProgramUnit"("program_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingHour_program_id_source_key_key" ON "TeachingHour"("program_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingHour_program_id_sequence_key" ON "TeachingHour"("program_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingHour_program_id_id_key" ON "TeachingHour"("program_id", "id");

-- CreateIndex
CREATE INDEX "ProgramAssessment_program_id_unit_id_idx" ON "ProgramAssessment"("program_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssessment_program_id_source_key_key" ON "ProgramAssessment"("program_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssessment_program_id_sequence_key" ON "ProgramAssessment"("program_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssessment_unit_id_id_key" ON "ProgramAssessment"("unit_id", "id");

-- CreateIndex
CREATE INDEX "ProgramActivity_program_id_teaching_hour_id_idx" ON "ProgramActivity"("program_id", "teaching_hour_id");

-- CreateIndex
CREATE INDEX "ProgramActivity_program_id_unit_id_idx" ON "ProgramActivity"("program_id", "unit_id");

-- CreateIndex
CREATE INDEX "ProgramActivity_unit_id_assessment_id_idx" ON "ProgramActivity"("unit_id", "assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramActivity_program_id_source_key_key" ON "ProgramActivity"("program_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramActivity_program_id_sequence_key" ON "ProgramActivity"("program_id", "sequence");

-- CreateIndex
CREATE INDEX "ProgramActivityLesson_lesson_id_idx" ON "ProgramActivityLesson"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramActivityLesson_activity_id_lesson_id_part_key" ON "ProgramActivityLesson"("activity_id", "lesson_id", "part");

-- CreateIndex
CREATE INDEX "StagePlanItem_program_activity_id_idx" ON "StagePlanItem"("program_activity_id");

-- AddForeignKey
ALTER TABLE "StagePlanItem" ADD CONSTRAINT "StagePlanItem_program_activity_id_fkey" FOREIGN KEY ("program_activity_id") REFERENCES "ProgramActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLesson" ADD CONSTRAINT "BookLesson_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingProgram" ADD CONSTRAINT "TeachingProgram_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingProgram" ADD CONSTRAINT "TeachingProgram_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "TeachingModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramUnit" ADD CONSTRAINT "ProgramUnit_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "TeachingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingHour" ADD CONSTRAINT "TeachingHour_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "TeachingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssessment" ADD CONSTRAINT "ProgramAssessment_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "TeachingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssessment" ADD CONSTRAINT "ProgramAssessment_program_id_unit_id_fkey" FOREIGN KEY ("program_id", "unit_id") REFERENCES "ProgramUnit"("program_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_program_id_teaching_hour_id_fkey" FOREIGN KEY ("program_id", "teaching_hour_id") REFERENCES "TeachingHour"("program_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_program_id_unit_id_fkey" FOREIGN KEY ("program_id", "unit_id") REFERENCES "ProgramUnit"("program_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_unit_id_assessment_id_fkey" FOREIGN KEY ("unit_id", "assessment_id") REFERENCES "ProgramAssessment"("unit_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivityLesson" ADD CONSTRAINT "ProgramActivityLesson_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "ProgramActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivityLesson" ADD CONSTRAINT "ProgramActivityLesson_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "BookLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Classify the existing catalog explicitly; teen product lines remain ADULT.
UPDATE "Track" AS track SET age_group = 'CHILD'
FROM "ProductLine" AS line
WHERE track.product_line_id = line.id AND line.key = 'kids';

ALTER TABLE "Stage" ADD CONSTRAINT stage_book_lesson_count_positive CHECK (book_lesson_count IS NULL OR book_lesson_count > 0);
ALTER TABLE "TeachingModality" ADD CONSTRAINT teaching_modality_weekly_hours CHECK (weekly_minutes >= 60 AND weekly_minutes % 60 = 0);
ALTER TABLE "TeachingHour" ADD CONSTRAINT teaching_hour_sixty_minutes CHECK (duration_minutes = 60);
ALTER TABLE "ProgramActivity" ADD CONSTRAINT program_activity_positive_duration CHECK (duration_minutes > 0 AND duration_minutes <= 60);
ALTER TABLE "ProgramActivity" ADD CONSTRAINT program_activity_assessment_kind CHECK ((kind = 'ASSESSMENT') = (assessment_id IS NOT NULL));
CREATE UNIQUE INDEX teaching_program_current ON "TeachingProgram" (stage_id, modality_id, schedule_type) WHERE retired_at IS NULL AND deleted_at IS NULL;
