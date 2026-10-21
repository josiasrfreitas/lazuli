-- CreateEnum
CREATE TYPE "AcademicCompetence" AS ENUM ('ORAL', 'LISTENING', 'WRITTEN', 'PARTICIPATION');

-- CreateEnum
CREATE TYPE "AssessmentPhase" AS ENUM ('BLOCK_ONE', 'BLOCK_TWO', 'RECOVERY');

-- CreateEnum
CREATE TYPE "AcademicDecision" AS ENUM ('APPROVED', 'REPEAT');

-- CreateEnum
CREATE TYPE "AppointmentPurpose" AS ENUM ('MAKEUP', 'PPT_COMPLEMENT', 'REINFORCEMENT', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentFileStatus" AS ENUM ('UPLOADING', 'RECEIVED', 'PROCESSING', 'READY', 'FAILED', 'REJECTED', 'REMOVED');

-- AlterTable
ALTER TABLE "PedagogicalProgress" ADD COLUMN     "assessment_id" UUID;

-- CreateTable
CREATE TABLE "StageAssessment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "started_on" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "observations" JSONB,
    "decision" "AcademicDecision",
    "decision_reason" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "confirmed_by_id" UUID,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "StageAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentGrade" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "assessment_id" UUID NOT NULL,
    "phase" "AssessmentPhase" NOT NULL,
    "competence" "AcademicCompetence" NOT NULL,
    "score" DECIMAL(4,1) NOT NULL,
    "assessed_on" DATE NOT NULL,
    "reason" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "AssessmentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalAppointment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "teacher_id" UUID,
    "target_class_session_id" UUID,
    "legacy_makeup_id" UUID,
    "rescheduled_from_id" UUID,
    "purpose" "AppointmentPurpose" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "format" "ClassFormat" NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "planned_content" TEXT,
    "performed_content" TEXT,
    "performed_minutes" INTEGER,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_by_id" UUID,
    "recorded_at" TIMESTAMPTZ,
    "recorded_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,

    CONSTRAINT "PedagogicalAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentFile" (
    "deleted_at" TIMESTAMPTZ,
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "phase" "AssessmentPhase" NOT NULL,
    "competence" "AcademicCompetence",
    "appointment_id" UUID,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "bucket" TEXT,
    "key" TEXT,
    "checksum" TEXT,
    "status" "AssessmentFileStatus" NOT NULL DEFAULT 'UPLOADING',
    "failure_code" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "received_at" TIMESTAMPTZ,
    "processed_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,
    "removed_by_id" UUID,
    "removal_reason" TEXT,

    CONSTRAINT "AssessmentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeupCoverage" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "appointment_id" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "MakeupCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRevision" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "appointment_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actor_id" UUID,
    "recorded_at" TIMESTAMPTZ NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "AppointmentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceContact" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "attendance_id" UUID,
    "actor_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacted_at" TIMESTAMPTZ NOT NULL,
    "channel" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "next_contact_date" DATE,

    CONSTRAINT "AbsenceContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageAssessment_student_id_started_on_idx" ON "StageAssessment"("student_id", "started_on");

-- CreateIndex
CREATE INDEX "StageAssessment_stage_id_idx" ON "StageAssessment"("stage_id");

-- CreateIndex
CREATE INDEX "AssessmentGrade_recorded_by_id_idx" ON "AssessmentGrade"("recorded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentGrade_assessment_id_phase_competence_key" ON "AssessmentGrade"("assessment_id", "phase", "competence");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalAppointment_legacy_makeup_id_key" ON "PedagogicalAppointment"("legacy_makeup_id");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalAppointment_rescheduled_from_id_key" ON "PedagogicalAppointment"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "PedagogicalAppointment_student_id_date_idx" ON "PedagogicalAppointment"("student_id", "date");

-- CreateIndex
CREATE INDEX "PedagogicalAppointment_teacher_id_date_idx" ON "PedagogicalAppointment"("teacher_id", "date");

-- CreateIndex
CREATE INDEX "PedagogicalAppointment_date_status_idx" ON "PedagogicalAppointment"("date", "status");

-- CreateIndex
CREATE INDEX "PedagogicalAppointment_enrollment_id_idx" ON "PedagogicalAppointment"("enrollment_id");

-- CreateIndex
CREATE INDEX "PedagogicalAppointment_target_class_session_id_idx" ON "PedagogicalAppointment"("target_class_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentFile_key_key" ON "AssessmentFile"("key");

-- CreateIndex
CREATE INDEX "AssessmentFile_assessment_id_phase_idx" ON "AssessmentFile"("assessment_id", "phase");

-- CreateIndex
CREATE INDEX "AssessmentFile_appointment_id_idx" ON "AssessmentFile"("appointment_id");

-- CreateIndex
CREATE INDEX "AssessmentFile_status_updated_at_idx" ON "AssessmentFile"("status", "updated_at");

-- CreateIndex
CREATE INDEX "AssessmentFile_uploaded_by_id_idx" ON "AssessmentFile"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "MakeupCoverage_attendance_id_idx" ON "MakeupCoverage"("attendance_id");

-- CreateIndex
CREATE UNIQUE INDEX "MakeupCoverage_appointment_id_attendance_id_key" ON "MakeupCoverage"("appointment_id", "attendance_id");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRevision_appointment_id_version_key" ON "AppointmentRevision"("appointment_id", "version");

-- CreateIndex
CREATE INDEX "AbsenceContact_student_id_contacted_at_idx" ON "AbsenceContact"("student_id", "contacted_at");

-- CreateIndex
CREATE INDEX "AbsenceContact_attendance_id_idx" ON "AbsenceContact"("attendance_id");

-- CreateIndex
CREATE INDEX "AbsenceContact_next_contact_date_idx" ON "AbsenceContact"("next_contact_date");

-- AddForeignKey
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentGrade" ADD CONSTRAINT "AssessmentGrade_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentGrade" ADD CONSTRAINT "AssessmentGrade_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_target_class_session_id_fkey" FOREIGN KEY ("target_class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_legacy_makeup_id_fkey" FOREIGN KEY ("legacy_makeup_id") REFERENCES "Makeup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "PedagogicalAppointment_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupCoverage" ADD CONSTRAINT "MakeupCoverage_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupCoverage" ADD CONSTRAINT "MakeupCoverage_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRevision" ADD CONSTRAINT "AppointmentRevision_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRevision" ADD CONSTRAINT "AppointmentRevision_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unsupported constraints and preserved historical makeup evidence.
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_confirmation_check" CHECK ((decision IS NULL AND confirmed_at IS NULL AND confirmed_by_id IS NULL) OR (decision IS NOT NULL AND confirmed_at IS NOT NULL AND confirmed_by_id IS NOT NULL));
ALTER TABLE "AssessmentGrade" ADD CONSTRAINT "AssessmentGrade_score_check" CHECK (score >= 0 AND score <= 100);

-- Historical makeups retain their identifiers and actual recorded evidence. No absence,
-- performed content, duration or author is inferred from free-text reasons.
INSERT INTO "PedagogicalAppointment" (
  "id", "created_at", "updated_at", "deleted_at", "student_id", "enrollment_id",
  "teacher_id", "target_class_session_id", "legacy_makeup_id", "purpose", "status",
  "format", "date", "start_time", "end_time", "notes", "version", "scheduled_at",
  "scheduled_by_id", "recorded_at", "recorded_by_id", "cancelled_at", "cancelled_by_id",
  "cancellation_reason"
)
SELECT m."id", m."created_at", m."updated_at", m."deleted_at", e."student_id", e."id",
  COALESCE(s."usual_teacher_id", c."teacher_id"), s."id", m."id", 'MAKEUP',
  CASE WHEN m."cancelled_at" IS NOT NULL THEN 'CANCELLED'::"AppointmentStatus"
       WHEN m."attended_at" IS NOT NULL THEN 'ATTENDED'::"AppointmentStatus"
       ELSE 'SCHEDULED'::"AppointmentStatus" END,
  c."format", s."date", s."start_time", s."end_time", m."reason", 0,
  m."scheduled_at", m."scheduled_by_id", m."attended_at", m."attended_by_id",
  m."cancelled_at", m."cancelled_by_id", m."cancellation_reason"
FROM "Makeup" m
JOIN "Enrollment" e ON e."id" = m."origin_enrollment_id"
JOIN "ClassSession" s ON s."id" = m."target_class_session_id"
JOIN "Class" c ON c."id" = s."class_id";

ALTER TABLE "PedagogicalAppointment"
  ADD CONSTRAINT "Appointment_valid_time" CHECK ("start_time" < "end_time"),
  ADD CONSTRAINT "Appointment_nonnegative_version" CHECK ("version" >= 0),
  ADD CONSTRAINT "Appointment_teacher_or_class" CHECK ("teacher_id" IS NOT NULL OR "target_class_session_id" IS NOT NULL),
  ADD CONSTRAINT "Appointment_actual_minutes" CHECK ("performed_minutes" IS NULL OR "performed_minutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "Appointment_recorded_account" CHECK (
    "status" <> 'ATTENDED' OR ("legacy_makeup_id" IS NOT NULL AND "version" = 0)
    OR ("performed_minutes" IS NOT NULL AND length(btrim("performed_content")) > 0
        AND "performed_content" IS NOT NULL AND "recorded_at" IS NOT NULL AND "recorded_by_id" IS NOT NULL)
  );
ALTER TABLE "MakeupCoverage" ADD CONSTRAINT "MakeupCoverage_positive_minutes" CHECK ("minutes" BETWEEN 1 AND 1440);
ALTER TABLE "AppointmentRevision" ADD CONSTRAINT "AppointmentRevision_kind" CHECK (
  "kind" IN ('IMPORTED', 'SCHEDULED', 'RECORDED', 'CORRECTED', 'CANCELLED', 'RESCHEDULED')
);
ALTER TABLE "AbsenceContact"
  ADD CONSTRAINT "AbsenceContact_channel" CHECK ("channel" IN ('PHONE', 'WHATSAPP', 'EMAIL', 'IN_PERSON')),
  ADD CONSTRAINT "AbsenceContact_outcome" CHECK ("outcome" IN ('NO_ANSWER', 'REPLIED', 'APPOINTMENT_AGREED', 'OTHER')),
  ADD CONSTRAINT "AbsenceContact_notes" CHECK (length(btrim("notes")) > 0);
