-- CreateEnum
CREATE TYPE "AcademicInterruptionKind" AS ENUM ('HOLIDAY', 'RECESS', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarReconciliationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "SchoolClosedDay" ADD COLUMN     "calendar_managed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AcademicInterruption" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "from_date" DATE NOT NULL,
    "through_date" DATE NOT NULL,
    "kind" "AcademicInterruptionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_key" TEXT,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "AcademicInterruption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarReconciliationRequest" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "from_date" DATE NOT NULL,
    "through_date" DATE NOT NULL,
    "semester_id" UUID,
    "reason" TEXT NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "CalendarReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "failure_code" TEXT,
    "cancelled_sessions" INTEGER NOT NULL DEFAULT 0,
    "cancelled_appointments" INTEGER NOT NULL DEFAULT 0,
    "cancelled_visits" INTEGER NOT NULL DEFAULT 0,
    "generated_sessions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CalendarReconciliationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicInterruption_source_key_key" ON "AcademicInterruption"("source_key");

-- CreateIndex
CREATE INDEX "AcademicInterruption_from_date_through_date_idx" ON "AcademicInterruption"("from_date", "through_date");

ALTER TABLE "AcademicInterruption"
  ADD CONSTRAINT "academic_interruption_range" CHECK ("from_date" <= "through_date"),
  ADD CONSTRAINT "academic_interruption_title" CHECK (length(btrim("title")) > 0);

ALTER TABLE "CalendarReconciliationRequest"
  ADD CONSTRAINT "calendar_reconciliation_range" CHECK ("from_date" <= "through_date"),
  ADD CONSTRAINT "calendar_reconciliation_counts" CHECK (
    "cancelled_sessions" >= 0 AND "cancelled_appointments" >= 0 AND
    "cancelled_visits" >= 0 AND "generated_sessions" >= 0
  );

-- CreateIndex
CREATE INDEX "AcademicInterruption_created_by_id_idx" ON "AcademicInterruption"("created_by_id");

-- CreateIndex
CREATE INDEX "CalendarReconciliationRequest_status_created_at_idx" ON "CalendarReconciliationRequest"("status", "created_at");

-- CreateIndex
CREATE INDEX "CalendarReconciliationRequest_requested_by_id_idx" ON "CalendarReconciliationRequest"("requested_by_id");

-- AddForeignKey
ALTER TABLE "AcademicInterruption" ADD CONSTRAINT "AcademicInterruption_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarReconciliationRequest" ADD CONSTRAINT "CalendarReconciliationRequest_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
