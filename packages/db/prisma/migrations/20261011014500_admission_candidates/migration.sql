-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('WAITING', 'ENROLLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntryVisitKind" AS ENUM ('TRIAL', 'INTRODUCTION');

-- CreateEnum
CREATE TYPE "EntryVisitStatus" AS ENUM ('SCHEDULED', 'ATTENDED', 'ABSENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdmissionCandidate" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'WAITING',
    "schedule_type" "ClassScheduleType" NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "stage_id" UUID,
    "student_id" UUID,
    "enrollment_id" UUID,
    "available_until" DATE NOT NULL,
    "availability_confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "AdmissionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionAvailability" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,

    CONSTRAINT "AdmissionAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryVisit" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "candidate_id" UUID NOT NULL,
    "kind" "EntryVisitKind" NOT NULL,
    "status" "EntryVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "teacher_id" UUID,
    "class_id" UUID,
    "schedule_slot_id" UUID,
    "class_session_id" UUID,
    "previous_visit_id" UUID,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "EntryVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionCandidate_enrollment_id_key" ON "AdmissionCandidate"("enrollment_id");

-- CreateIndex
CREATE INDEX "AdmissionCandidate_status_created_at_idx" ON "AdmissionCandidate"("status", "created_at");

-- CreateIndex
CREATE INDEX "AdmissionCandidate_stage_id_idx" ON "AdmissionCandidate"("stage_id");

-- CreateIndex
CREATE INDEX "AdmissionCandidate_student_id_idx" ON "AdmissionCandidate"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionAvailability_candidate_id_weekday_start_time_end_t_key" ON "AdmissionAvailability"("candidate_id", "weekday", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "EntryVisit_previous_visit_id_key" ON "EntryVisit"("previous_visit_id");

-- CreateIndex
CREATE INDEX "EntryVisit_candidate_id_date_idx" ON "EntryVisit"("candidate_id", "date");

-- CreateIndex
CREATE INDEX "EntryVisit_teacher_id_date_status_idx" ON "EntryVisit"("teacher_id", "date", "status");

-- CreateIndex
CREATE INDEX "EntryVisit_class_id_date_idx" ON "EntryVisit"("class_id", "date");

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionAvailability" ADD CONSTRAINT "AdmissionAvailability_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "AdmissionCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "AdmissionCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "ClassScheduleSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_previous_visit_id_fkey" FOREIGN KEY ("previous_visit_id") REFERENCES "EntryVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "AdmissionAvailability" ADD CONSTRAINT "AdmissionAvailability_time_check" CHECK (start_time < end_time);
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_contact_check" CHECK (NULLIF(btrim(phone), '') IS NOT NULL OR NULLIF(btrim(email), '') IS NOT NULL);
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_conversion_check" CHECK ((status = 'ENROLLED') = (enrollment_id IS NOT NULL));
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_time_check" CHECK (start_time < end_time);
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_kind_check" CHECK (
  (kind = 'TRIAL' AND class_id IS NOT NULL AND (schedule_slot_id IS NOT NULL OR class_session_id IS NOT NULL)) OR
  (kind = 'INTRODUCTION' AND teacher_id IS NOT NULL AND class_id IS NULL AND schedule_slot_id IS NULL AND class_session_id IS NULL)
);
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_cancellation_check" CHECK (status <> 'CANCELLED' OR NULLIF(btrim(cancellation_reason), '') IS NOT NULL);
