-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ClassScheduleType" AS ENUM ('REGULAR', 'PERSONALIZED');

-- CreateEnum
CREATE TYPE "ClassFormat" AS ENUM ('IN_PERSON', 'ONLINE');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Class" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "internal_code" TEXT NOT NULL,
    "teacher_id" UUID NOT NULL,
    "schedule_type" "ClassScheduleType" NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "shared_stage_id" UUID,
    "semester_id" UUID,
    "year" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "previous_class_id" UUID,
    "portal_class_name" TEXT NOT NULL,
    "original_portal_class_name" TEXT,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleSlot" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_id" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,

    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Class_internal_code_key" ON "Class"("internal_code");

-- CreateIndex
CREATE INDEX "Class_teacher_id_idx" ON "Class"("teacher_id");

-- CreateIndex
CREATE INDEX "Class_shared_stage_id_idx" ON "Class"("shared_stage_id");

-- CreateIndex
CREATE INDEX "Class_semester_id_idx" ON "Class"("semester_id");

-- CreateIndex
CREATE INDEX "Class_previous_class_id_idx" ON "Class"("previous_class_id");

-- CreateIndex
CREATE INDEX "ClassScheduleSlot_class_id_idx" ON "ClassScheduleSlot"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "ClassScheduleSlot_class_id_weekday_start_time_end_time_key" ON "ClassScheduleSlot"("class_id", "weekday", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "ClassScheduleSlot_class_id_id_key" ON "ClassScheduleSlot"("class_id", "id");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_shared_stage_id_fkey" FOREIGN KEY ("shared_stage_id") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_previous_class_id_fkey" FOREIGN KEY ("previous_class_id") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): class capacity must be positive.
ALTER TABLE "Class" ADD CONSTRAINT "Class_capacity_positive_check"
CHECK ("capacity" > 0);

-- AddCheckConstraint (TECHNICAL_SPEC §4.4, D-0021): REGULAR classes require a shared stage.
ALTER TABLE "Class" ADD CONSTRAINT "Class_regular_requires_shared_stage_check"
CHECK (
  ("schedule_type" = 'REGULAR' AND "shared_stage_id" IS NOT NULL)
  OR ("schedule_type" = 'PERSONALIZED' AND "shared_stage_id" IS NULL)
);

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): REGULAR classes require a semester for generation.
ALTER TABLE "Class" ADD CONSTRAINT "Class_regular_requires_semester_check"
CHECK (
  ("schedule_type" = 'REGULAR' AND "semester_id" IS NOT NULL)
  OR ("schedule_type" = 'PERSONALIZED')
);

-- AddCheckConstraint (TECHNICAL_SPEC §4.4): schedule slots must have start before end.
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_start_before_end_check"
CHECK ("start_time" < "end_time");

-- Partial unique index (TECHNICAL_SPEC §4.4): active classes have unique portal class names.
CREATE UNIQUE INDEX "Class_active_portal_class_name_key"
ON "Class"("portal_class_name")
WHERE ("status" = 'ACTIVE' AND "deleted_at" IS NULL);
