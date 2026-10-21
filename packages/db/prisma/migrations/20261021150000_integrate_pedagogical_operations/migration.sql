-- Reconcile the unmerged pedagogical branch after main 8c2e28c.
-- Original SQL/checksums and owner-approved history exception: docs/development/pedagogical-migration-reconciliation.md.
-- All previously integrated main migrations remain byte-for-byte unchanged.
BEGIN;

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('WAITING', 'ENROLLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntryVisitKind" AS ENUM ('TRIAL', 'INTRODUCTION', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "EntryVisitStatus" AS ENUM ('SCHEDULED', 'ATTENDED', 'ABSENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcademicCompetence" AS ENUM ('ORAL', 'LISTENING', 'WRITTEN', 'PARTICIPATION');

-- CreateEnum
CREATE TYPE "AssessmentPhase" AS ENUM ('BLOCK_ONE', 'BLOCK_TWO', 'RECOVERY');

-- CreateEnum
CREATE TYPE "AcademicDecision" AS ENUM ('APPROVED', 'REPEAT');

-- CreateEnum
CREATE TYPE "OccurrenceCategory" AS ENUM ('MATERIAL', 'HOMEWORK', 'PARTICIPATION', 'BEHAVIOR', 'LEARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "AppointmentPurpose" AS ENUM ('MAKEUP', 'PPT_COMPLEMENT', 'REINFORCEMENT', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SemesterPlacementMode" AS ENUM ('ENTRY', 'CONTINUE', 'ADVANCE', 'REPEAT');

-- CreateEnum
CREATE TYPE "TrackAgeGroup" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "LeadInterest" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssessmentFileStatus" AS ENUM ('UPLOADING', 'RECEIVED', 'PROCESSING', 'READY', 'FAILED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MaterialPriceCategory" AS ENUM ('CHILD', 'ADULT');

-- CreateEnum
CREATE TYPE "MaterialPayment" AS ENUM ('INSTALLMENTS', 'CASH');

-- CreateEnum
CREATE TYPE "ProgramActivityKind" AS ENUM ('LESSON', 'INTRODUCTION', 'REVIEW', 'ASSESSMENT', 'VIDEO', 'ACTIVITY');

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "age_group" "TrackAgeGroup" NOT NULL DEFAULT 'ADULT';

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "book_lesson_count" INTEGER;

-- AlterTable
ALTER TABLE "EnrollmentAction" ADD COLUMN     "exit_reason" "EnrollmentExitReason";

-- AlterTable
ALTER TABLE "PedagogicalProgress" ADD COLUMN     "assessment_id" UUID;

-- AlterTable
ALTER TABLE "FinanceSettings" ADD COLUMN     "adult_material_installment_cents" INTEGER NOT NULL DEFAULT 13600,
ADD COLUMN     "adult_material_installments" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "child_material_installment_cents" INTEGER NOT NULL DEFAULT 12300,
ADD COLUMN     "child_material_installments" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "material_card_fee_pct" DECIMAL(7,4) NOT NULL DEFAULT 10,
ADD COLUMN     "material_cash_discount_pct" DECIMAL(7,4) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "next_material_purchase_on" DATE,
ADD COLUMN     "renewed_from_id" UUID,
ADD COLUMN     "terminated_at" TIMESTAMPTZ,
ADD COLUMN     "termination_command_id" UUID,
ADD COLUMN     "termination_fingerprint" TEXT,
ADD COLUMN     "termination_snapshot" JSONB;

-- AlterTable
ALTER TABLE "StagePlanItem" ADD COLUMN     "program_activity_id" UUID;

-- AlterTable
ALTER TABLE "AttendanceWindow" ADD COLUMN     "reference_accuracy" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AdmissionCandidate" (
    "allocation_pending_at" TIMESTAMPTZ,
    "allocation_pending_reason" TEXT,
    "allocation_plan_id" UUID,
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "full_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_role" TEXT NOT NULL DEFAULT 'STUDENT',
    "contact_owner" TEXT NOT NULL DEFAULT 'STUDENT',
    "birth_date" DATE,
    "english_experience" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT,
    "owner_id" UUID,
    "next_action" TEXT,
    "next_action_on" DATE,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "interest" "LeadInterest" NOT NULL DEFAULT 'UNKNOWN',
    "status" "AdmissionStatus" NOT NULL DEFAULT 'WAITING',
    "schedule_type" "ClassScheduleType",
    "format" "ClassFormat",
    "stage_id" UUID,
    "student_id" UUID,
    "enrollment_id" UUID,
    "available_until" DATE,
    "availability_confirmed_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
CREATE TABLE "LeadContact" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "candidate_id" UUID NOT NULL,
    "contacted_on" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalOccurrence" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "category" "OccurrenceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "initial_response" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "PedagogicalOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccurrenceRelation" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "OccurrenceRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalIntervention" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "responsible_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "performed_on" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PedagogicalIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionOccurrence" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "intervention_id" UUID NOT NULL,
    "occurrence_id" UUID NOT NULL,

    CONSTRAINT "InterventionOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalFollowUp" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "intervention_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "PedagogicalFollowUp_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "SemesterClassPlan" (
    "closed_at" TIMESTAMPTZ,
    "source_class_id" UUID,
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
    "continuity" TEXT NOT NULL DEFAULT 'UNDECIDED',
    "continuity_reason" TEXT,
    "effective_date" DATE,
    "declined_at" TIMESTAMPTZ,
    "declined_reason" TEXT,
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

-- CreateTable
CREATE TABLE "EntryVisitAssessment" (
    "visit_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID NOT NULL,
    "stage_id" UUID,
    "corrected_at" TIMESTAMPTZ,
    "corrected_by_id" UUID,
    "notes" TEXT,

    CONSTRAINT "EntryVisitAssessment_pkey" PRIMARY KEY ("visit_id")
);

-- CreateTable
CREATE TABLE "AssessmentFile" (
    "deleted_at" TIMESTAMPTZ,
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "phase" "AssessmentPhase" NOT NULL,
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
    "competence" "AcademicCompetence",

    CONSTRAINT "AssessmentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialOrder" (
    "order_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "command_id" UUID,
    "command_fingerprint" TEXT,
    "name" TEXT NOT NULL,
    "stage_code" TEXT NOT NULL,
    "category" "MaterialPriceCategory" NOT NULL,
    "payment" "MaterialPayment" NOT NULL,
    "list_price_cents" INTEGER NOT NULL,
    "cash_discount_pct" DECIMAL(7,4) NOT NULL,
    "charged_amount_cents" INTEGER,
    "card_fee_pct" DECIMAL(7,4),
    "card_fee_cents" INTEGER,
    "quoted_installments" INTEGER NOT NULL,
    "quoted_installment_cents" INTEGER NOT NULL,

    CONSTRAINT "MaterialOrder_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "MaterialOrderItem" (
    "order_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "stage_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage_code" TEXT NOT NULL,

    CONSTRAINT "MaterialOrderItem_pkey" PRIMARY KEY ("order_id","position")
);

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

-- CreateTable
CREATE TABLE "EntryVisitCorrectedFile" (
    "visit_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID NOT NULL,

    CONSTRAINT "EntryVisitCorrectedFile_pkey" PRIMARY KEY ("visit_id")
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

-- CreateIndex
CREATE INDEX "StageAssessment_student_id_started_on_idx" ON "StageAssessment"("student_id", "started_on");

-- CreateIndex
CREATE INDEX "StageAssessment_stage_id_idx" ON "StageAssessment"("stage_id");

-- CreateIndex
CREATE INDEX "AssessmentGrade_recorded_by_id_idx" ON "AssessmentGrade"("recorded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentGrade_assessment_id_phase_competence_key" ON "AssessmentGrade"("assessment_id", "phase", "competence");

-- CreateIndex
CREATE INDEX "LeadContact_candidate_id_contacted_on_idx" ON "LeadContact"("candidate_id", "contacted_on");

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_student_id_created_at_idx" ON "PedagogicalOccurrence"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_recorded_by_id_created_at_idx" ON "PedagogicalOccurrence"("recorded_by_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_class_session_id_idx" ON "PedagogicalOccurrence"("class_session_id");

-- CreateIndex
CREATE INDEX "OccurrenceRelation_to_id_idx" ON "OccurrenceRelation"("to_id");

-- CreateIndex
CREATE UNIQUE INDEX "OccurrenceRelation_from_id_to_id_key" ON "OccurrenceRelation"("from_id", "to_id");

-- CreateIndex
CREATE INDEX "PedagogicalIntervention_student_id_performed_on_idx" ON "PedagogicalIntervention"("student_id", "performed_on");

-- CreateIndex
CREATE INDEX "PedagogicalIntervention_responsible_id_performed_on_idx" ON "PedagogicalIntervention"("responsible_id", "performed_on");

-- CreateIndex
CREATE INDEX "InterventionOccurrence_occurrence_id_idx" ON "InterventionOccurrence"("occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionOccurrence_intervention_id_occurrence_id_key" ON "InterventionOccurrence"("intervention_id", "occurrence_id");

-- CreateIndex
CREATE INDEX "PedagogicalFollowUp_intervention_id_created_at_idx" ON "PedagogicalFollowUp"("intervention_id", "created_at");

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
CREATE UNIQUE INDEX "MaterialOrder_command_id_key" ON "MaterialOrder"("command_id");

-- CreateIndex
CREATE INDEX "MaterialOrder_stage_id_idx" ON "MaterialOrder"("stage_id");

-- CreateIndex
CREATE INDEX "MaterialOrderItem_stage_id_idx" ON "MaterialOrderItem"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialOrderItem_order_id_stage_id_key" ON "MaterialOrderItem"("order_id", "stage_id");

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
CREATE UNIQUE INDEX "Contract_termination_command_id_key" ON "Contract"("termination_command_id");

-- CreateIndex
CREATE INDEX "Contract_renewed_from_id_idx" ON "Contract"("renewed_from_id");

-- CreateIndex
CREATE INDEX "StagePlanItem_program_activity_id_idx" ON "StagePlanItem"("program_activity_id");

-- AddForeignKey
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StagePlanItem" ADD CONSTRAINT "StagePlanItem_program_activity_id_fkey" FOREIGN KEY ("program_activity_id") REFERENCES "ProgramActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_allocation_plan_id_fkey" FOREIGN KEY ("allocation_plan_id") REFERENCES "SemesterClassPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "AdmissionCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOccurrence" ADD CONSTRAINT "InterventionOccurrence_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "PedagogicalIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOccurrence" ADD CONSTRAINT "InterventionOccurrence_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "PedagogicalIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_source_class_id_fkey" FOREIGN KEY ("source_class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

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

-- AddForeignKey
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "EntryVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "MaterialOrder"("order_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

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

-- AddForeignKey
ALTER TABLE "EntryVisitCorrectedFile" ADD CONSTRAINT "EntryVisitCorrectedFile_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "EntryVisitAssessment"("visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitCorrectedFile" ADD CONSTRAINT "EntryVisitCorrectedFile_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- PostgreSQL constraints from the final source schema; all main constraints are retained.
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_channel" CHECK ((channel = ANY (ARRAY['PHONE'::text, 'WHATSAPP'::text, 'EMAIL'::text, 'IN_PERSON'::text])));
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_notes" CHECK ((length(btrim(notes)) > 0));
ALTER TABLE "AbsenceContact" ADD CONSTRAINT "AbsenceContact_outcome" CHECK ((outcome = ANY (ARRAY['NO_ANSWER'::text, 'REPLIED'::text, 'APPOINTMENT_AGREED'::text, 'OTHER'::text])));
ALTER TABLE "AdmissionAvailability" ADD CONSTRAINT "AdmissionAvailability_time_check" CHECK ((start_time < end_time));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_contact_check" CHECK (((NULLIF(btrim(phone), ''::text) IS NOT NULL) OR (NULLIF(btrim(email), ''::text) IS NOT NULL)));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_contact_owner_check" CHECK ((contact_owner = ANY (ARRAY['STUDENT'::text, 'GUARDIAN'::text])));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_contact_role_check" CHECK ((contact_role = ANY (ARRAY['STUDENT'::text, 'GUARDIAN'::text])));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_conversion_check" CHECK (((status = 'ENROLLED'::"AdmissionStatus") = (enrollment_id IS NOT NULL)));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_english_experience_check" CHECK ((english_experience = ANY (ARRAY['NONE'::text, 'SOME'::text, 'UNKNOWN'::text])));
ALTER TABLE "AdmissionCandidate" ADD CONSTRAINT "AdmissionCandidate_next_action_check" CHECK (((next_action IS NULL) = (next_action_on IS NULL)));
ALTER TABLE "AppointmentRevision" ADD CONSTRAINT "AppointmentRevision_kind" CHECK ((kind = ANY (ARRAY['IMPORTED'::text, 'SCHEDULED'::text, 'RECORDED'::text, 'CORRECTED'::text, 'CANCELLED'::text, 'RESCHEDULED'::text])));
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_byte_length_check" CHECK (((byte_length > 0) AND (byte_length <= 20971520)));
ALTER TABLE "AssessmentFile" ADD CONSTRAINT "AssessmentFile_written_competence_check" CHECK (((competence IS NULL) OR (competence = ANY (ARRAY['WRITTEN'::"AcademicCompetence", 'LISTENING'::"AcademicCompetence"]))));
ALTER TABLE "AssessmentGrade" ADD CONSTRAINT "AssessmentGrade_score_check" CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)));
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_termination_complete_check" CHECK ((((terminated_at IS NULL) AND (termination_command_id IS NULL) AND (termination_fingerprint IS NULL) AND (termination_snapshot IS NULL)) OR ((terminated_at IS NOT NULL) AND (termination_command_id IS NOT NULL) AND (termination_fingerprint IS NOT NULL) AND (termination_snapshot IS NOT NULL))));
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_exit_reason_check" CHECK (((exit_reason IS NULL) OR ((kind = 'EXIT'::"EnrollmentActionKind") AND (exit_reason = ANY (ARRAY['TRANSFERRED'::"EnrollmentExitReason", 'DROPPED'::"EnrollmentExitReason"])))));
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_cancellation_check" CHECK (((status <> 'CANCELLED'::"EntryVisitStatus") OR (NULLIF(btrim(cancellation_reason), ''::text) IS NOT NULL)));
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_kind_check" CHECK (((((kind)::text = 'TRIAL'::text) AND (class_id IS NOT NULL) AND ((schedule_slot_id IS NOT NULL) OR (class_session_id IS NOT NULL))) OR (((kind)::text = 'INTRODUCTION'::text) AND (teacher_id IS NOT NULL) AND (class_id IS NULL) AND (schedule_slot_id IS NULL) AND (class_session_id IS NULL)) OR (((kind)::text = 'PLACEMENT'::text) AND (class_id IS NULL) AND (schedule_slot_id IS NULL) AND (class_session_id IS NULL))));
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_time_check" CHECK ((start_time < end_time));
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_byte_length_check" CHECK ((byte_length > 0));
ALTER TABLE "EntryVisitAssessment" ADD CONSTRAINT "EntryVisitAssessment_result_check" CHECK ((((stage_id IS NULL) AND (corrected_at IS NULL) AND (corrected_by_id IS NULL)) OR ((stage_id IS NOT NULL) AND (corrected_at IS NOT NULL) AND (corrected_by_id IS NOT NULL))));
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_material_card_fee_pct_check" CHECK (((material_card_fee_pct >= (0)::numeric) AND (material_card_fee_pct <= (100)::numeric)));
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "book_pricing_discount_bounds" CHECK (((material_cash_discount_pct >= (0)::numeric) AND (material_cash_discount_pct <= (100)::numeric)));
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "book_pricing_nonnegative_amounts" CHECK (((child_material_installment_cents >= 0) AND (adult_material_installment_cents >= 0)));
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "book_pricing_positive_installments" CHECK (((child_material_installments > 0) AND (adult_material_installments > 0)));
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "book_pricing_total_bounds" CHECK (((((child_material_installments)::bigint * child_material_installment_cents) <= 2147483647) AND (((adult_material_installments)::bigint * adult_material_installment_cents) <= 2147483647)));
ALTER TABLE "MakeupCoverage" ADD CONSTRAINT "MakeupCoverage_positive_minutes" CHECK (((minutes >= 1) AND (minutes <= 1440)));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_cash_discount_pct_check" CHECK (((cash_discount_pct >= (0)::numeric) AND (cash_discount_pct <= (100)::numeric)));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_list_price_cents_check" CHECK ((list_price_cents >= 0));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_quoted_installment_cents_check" CHECK ((quoted_installment_cents >= 0));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_quoted_installments_check" CHECK ((quoted_installments > 0));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "material_card_terms_valid" CHECK ((((charged_amount_cents IS NULL) AND (card_fee_pct IS NULL) AND (card_fee_cents IS NULL)) OR ((charged_amount_cents IS NOT NULL) AND (card_fee_pct IS NOT NULL) AND (card_fee_cents IS NOT NULL) AND (charged_amount_cents > 0) AND ((card_fee_pct >= (0)::numeric) AND (card_fee_pct <= (100)::numeric)) AND (card_fee_cents >= 0) AND (card_fee_cents < charged_amount_cents))));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "material_list_price_matches_quote" CHECK (((list_price_cents)::bigint = ((quoted_installments)::bigint * (quoted_installment_cents)::bigint)));
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_position_check" CHECK (("position" > 0));
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_order_check" CHECK ((from_id < to_id));
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "Appointment_actual_minutes" CHECK (((performed_minutes IS NULL) OR ((performed_minutes >= 1) AND (performed_minutes <= 1440))));
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "Appointment_nonnegative_version" CHECK ((version >= 0));
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "Appointment_recorded_account" CHECK (((status <> 'ATTENDED'::"AppointmentStatus") OR ((legacy_makeup_id IS NOT NULL) AND (version = 0)) OR ((performed_minutes IS NOT NULL) AND (length(btrim(performed_content)) > 0) AND (performed_content IS NOT NULL) AND (recorded_at IS NOT NULL) AND (recorded_by_id IS NOT NULL))));
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "Appointment_teacher_or_class" CHECK (((teacher_id IS NOT NULL) OR (target_class_session_id IS NOT NULL)));
ALTER TABLE "PedagogicalAppointment" ADD CONSTRAINT "Appointment_valid_time" CHECK ((start_time < end_time));
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "program_activity_assessment_kind" CHECK (((kind = 'ASSESSMENT'::"ProgramActivityKind") = (assessment_id IS NOT NULL)));
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "program_activity_positive_duration" CHECK (((duration_minutes > 0) AND (duration_minutes <= 60)));
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_stage_kind_check" CHECK (((schedule_type = 'REGULAR'::"ClassScheduleType") = (shared_stage_id IS NOT NULL)));
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_continuity_check" CHECK ((continuity = ANY (ARRAY['UNDECIDED'::text, 'STAY'::text, 'CHANGE'::text, 'LEAVING'::text])));
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_publication_check" CHECK (((published_at IS NULL) OR ((plan_id IS NOT NULL) AND (stage_id IS NOT NULL) AND (published_by_id IS NOT NULL) AND (enrollment_id IS NOT NULL) AND (((entry_action_id IS NOT NULL) AND (availability_id IS NOT NULL)) OR ((mode = 'CONTINUE'::"SemesterPlacementMode") AND (source_enrollment_id IS NOT NULL) AND (source_enrollment_id = enrollment_id) AND (entry_action_id IS NULL) AND (source_exit_action_id IS NULL))))));
ALTER TABLE "SemesterPlacement" ADD CONSTRAINT "SemesterPlacement_source_pair_check" CHECK (((source_enrollment_id IS NULL) = (source_progress_id IS NULL)));
ALTER TABLE "Stage" ADD CONSTRAINT "stage_book_lesson_count_positive" CHECK (((book_lesson_count IS NULL) OR (book_lesson_count > 0)));
ALTER TABLE "StageAssessment" ADD CONSTRAINT "StageAssessment_confirmation_check" CHECK ((((decision IS NULL) AND (confirmed_at IS NULL) AND (confirmed_by_id IS NULL)) OR ((decision IS NOT NULL) AND (confirmed_at IS NOT NULL) AND (confirmed_by_id IS NOT NULL))));
ALTER TABLE "TeachingHour" ADD CONSTRAINT "teaching_hour_sixty_minutes" CHECK ((duration_minutes = 60));
ALTER TABLE "TeachingModality" ADD CONSTRAINT "teaching_modality_weekly_hours" CHECK (((weekly_minutes >= 60) AND ((weekly_minutes % 60) = 0)));

-- Partial indexes not expressible by Prisma.
CREATE INDEX "AdmissionCandidate_allocation_pending_at_idx" ON public."AdmissionCandidate" USING btree (allocation_pending_at) WHERE ((deleted_at IS NULL) AND (status = 'WAITING'::"AdmissionStatus"));
CREATE UNIQUE INDEX "SemesterClassPlan_semester_source_active" ON public."SemesterClassPlan" USING btree (semester_id, source_class_id) WHERE ((deleted_at IS NULL) AND (source_class_id IS NOT NULL));
CREATE UNIQUE INDEX "SemesterPlacement_live_student_track_key" ON public."SemesterPlacement" USING btree (semester_id, student_id, track_id) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX teaching_program_current ON public."TeachingProgram" USING btree (stage_id, modality_id, schedule_type) WHERE ((retired_at IS NULL) AND (deleted_at IS NULL));

-- Extend existing order constraints for contract materials and single direct receipts.
ALTER TABLE "Order" DROP CONSTRAINT "Order_party_source_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_party_source_check" CHECK ((((contract_id IS NOT NULL) AND (payer_id IS NULL) AND (kind = ANY (ARRAY['TUITION'::"OrderKind", 'MATERIAL'::"OrderKind"]))) OR ((contract_id IS NULL) AND (payer_id IS NOT NULL))));
ALTER TABLE "Order" DROP CONSTRAINT "Order_due_day_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_due_day_check" CHECK ((((contract_id IS NOT NULL) AND ((due_day >= 1) AND (due_day <= 31))) OR ((contract_id IS NULL) AND (due_day = ANY (ARRAY[5, 10, 15, 20, 25]))) OR ((contract_id IS NULL) AND (kind = 'OTHER'::"OrderKind") AND (installment_count IS NOT NULL) AND (installment_count = 1) AND (first_due_date IS NOT NULL) AND ((due_day)::numeric = EXTRACT(day FROM first_due_date)))));

-- Preserve historical makeup identifiers and recorded evidence without inventing content.
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

-- Preserve the catalog classification introduced by the original program migration.
UPDATE "Track" AS track SET age_group = 'CHILD'
FROM "ProductLine" AS line
WHERE track.product_line_id = line.id AND line.key = 'kids';

COMMIT;
