-- CreateEnum
CREATE TYPE "SemesterPlacementMode" AS ENUM ('ENTRY', 'CONTINUE', 'ADVANCE', 'REPEAT');

-- AlterTable
ALTER TABLE "EnrollmentAction" ADD COLUMN     "exit_reason" "EnrollmentExitReason";

-- CreateTable
CREATE TABLE "SemesterClassPlan" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "semester_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "schedule_type" "ClassScheduleType" NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "shared_stage_id" UUID,
    "teacher_id" UUID,
    "slots" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "class_id" UUID,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "SemesterClassPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAvailability" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "valid_until" DATE NOT NULL,
    "formats" "ClassFormat"[],
    "slots" JSONB NOT NULL,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "StudentAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterPlacement" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "semester_id" UUID NOT NULL,
    "plan_id" UUID,
    "student_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "stage_id" UUID,
    "source_enrollment_id" UUID,
    "source_progress_id" UUID,
    "mode" "SemesterPlacementMode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ,
    "published_by_id" UUID,
    "enrollment_id" UUID,
    "entry_action_id" UUID,
    "source_exit_action_id" UUID,
    "availability_id" UUID,
    "published_evidence" JSONB,

    CONSTRAINT "SemesterPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterPlacementRevision" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "placement_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "recorded_by_id" UUID,

    CONSTRAINT "SemesterPlacementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SemesterClassPlan_class_id_key" ON "SemesterClassPlan"("class_id");

-- CreateIndex
CREATE INDEX "SemesterClassPlan_semester_id_idx" ON "SemesterClassPlan"("semester_id");

-- CreateIndex
CREATE INDEX "StudentAvailability_student_id_semester_id_created_at_idx" ON "StudentAvailability"("student_id", "semester_id", "created_at");

-- CreateIndex
CREATE INDEX "SemesterPlacement_semester_id_plan_id_idx" ON "SemesterPlacement"("semester_id", "plan_id");

-- CreateIndex
CREATE INDEX "SemesterPlacement_entry_action_id_idx" ON "SemesterPlacement"("entry_action_id");

-- CreateIndex
CREATE INDEX "SemesterPlacement_source_exit_action_id_idx" ON "SemesterPlacement"("source_exit_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterPlacementRevision_placement_id_version_key" ON "SemesterPlacementRevision"("placement_id", "version");

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_shared_stage_id_fkey" FOREIGN KEY ("shared_stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailability" ADD CONSTRAINT "StudentAvailability_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailability" ADD CONSTRAINT "StudentAvailability_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailability" ADD CONSTRAINT "StudentAvailability_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "SemesterClassPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_source_enrollment_id_fkey" FOREIGN KEY ("source_enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_source_progress_id_fkey" FOREIGN KEY ("source_progress_id") REFERENCES "PedagogicalProgress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_entry_action_id_fkey" FOREIGN KEY ("entry_action_id") REFERENCES "EnrollmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_source_exit_action_id_fkey" FOREIGN KEY ("source_exit_action_id") REFERENCES "EnrollmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "StudentAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacementRevision" ADD CONSTRAINT "SemesterPlacementRevision_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "SemesterPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacementRevision" ADD CONSTRAINT "SemesterPlacementRevision_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SemesterPlacement_live_student_track_key"
  ON "SemesterPlacement" ("semester_id", "student_id", "track_id") WHERE "deleted_at" IS NULL;
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_stage_kind_check"
  CHECK (("schedule_type" = 'REGULAR') = ("shared_stage_id" IS NOT NULL));
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_source_pair_check"
  CHECK (("source_enrollment_id" IS NULL) = ("source_progress_id" IS NULL));
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_publication_check"
  CHECK ("published_at" IS NULL OR ("plan_id" IS NOT NULL AND "stage_id" IS NOT NULL AND "published_by_id" IS NOT NULL AND "enrollment_id" IS NOT NULL AND "entry_action_id" IS NOT NULL AND "availability_id" IS NOT NULL));
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_exit_reason_check"
  CHECK ("exit_reason" IS NULL OR ("kind" = 'EXIT' AND "exit_reason" IN ('TRANSFERRED', 'DROPPED')));
