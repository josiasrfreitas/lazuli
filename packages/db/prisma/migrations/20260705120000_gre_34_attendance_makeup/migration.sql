-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "enrollment_id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID,
    "notes" TEXT,
    "last_modified_at" TIMESTAMPTZ,
    "last_modified_by_id" UUID,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Makeup" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "origin_enrollment_id" UUID NOT NULL,
    "target_class_session_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_by_id" UUID,
    "reason" TEXT,
    "attended_at" TIMESTAMPTZ,
    "attended_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,

    CONSTRAINT "Makeup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_enrollment_id_idx" ON "Attendance"("enrollment_id");

-- CreateIndex
CREATE INDEX "Attendance_class_session_id_idx" ON "Attendance"("class_session_id");

-- CreateIndex
CREATE INDEX "Attendance_recorded_by_id_idx" ON "Attendance"("recorded_by_id");

-- CreateIndex
CREATE INDEX "Attendance_last_modified_by_id_idx" ON "Attendance"("last_modified_by_id");

-- CreateIndex
CREATE INDEX "Makeup_origin_enrollment_id_idx" ON "Makeup"("origin_enrollment_id");

-- CreateIndex
CREATE INDEX "Makeup_target_class_session_id_idx" ON "Makeup"("target_class_session_id");

-- CreateIndex
CREATE INDEX "Makeup_scheduled_by_id_idx" ON "Makeup"("scheduled_by_id");

-- CreateIndex
CREATE INDEX "Makeup_attended_by_id_idx" ON "Makeup"("attended_by_id");

-- CreateIndex
CREATE INDEX "Makeup_cancelled_by_id_idx" ON "Makeup"("cancelled_by_id");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_origin_enrollment_id_fkey" FOREIGN KEY ("origin_enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_target_class_session_id_fkey" FOREIGN KEY ("target_class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_attended_by_id_fkey" FOREIGN KEY ("attended_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index (TECHNICAL_SPEC §4.6): one attendance row per (enrollment, session).
CREATE UNIQUE INDEX "Attendance_enrollment_session_key"
ON "Attendance"("enrollment_id", "class_session_id")
WHERE ("deleted_at" IS NULL);

-- Partial unique index (TECHNICAL_SPEC §4.6): one makeup per (origin enrollment, target session).
CREATE UNIQUE INDEX "Makeup_origin_target_key"
ON "Makeup"("origin_enrollment_id", "target_class_session_id")
WHERE ("deleted_at" IS NULL);

-- AddCheckConstraint (TECHNICAL_SPEC §4.6, §1.2(8)): edit-attribution facts move together.
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_last_modified_facts_check"
CHECK (("last_modified_at" IS NULL) = ("last_modified_by_id" IS NULL));

-- AddCheckConstraint (TECHNICAL_SPEC §4.6): a makeup cannot be both cancelled and attended.
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_cancel_attend_exclusive_check"
CHECK ("cancelled_at" IS NULL OR "attended_at" IS NULL);
