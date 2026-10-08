-- CreateEnum
CREATE TYPE "EnrollmentActionKind" AS ENUM ('ENTRY', 'RETURN', 'PAUSE', 'EXIT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "EnrollmentActionStatus" AS ENUM ('SCHEDULED', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EnrollmentAction" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "source_enrollment_id" UUID,
    "kind" "EnrollmentActionKind" NOT NULL,
    "status" "EnrollmentActionStatus" NOT NULL,
    "effective_date" DATE NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_by_id" UUID,
    "correction_of_id" UUID,
    "previous_date" DATE,
    "justification" TEXT,

    CONSTRAINT "EnrollmentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentAction_enrollment_id_effective_date_idx" ON "EnrollmentAction"("enrollment_id", "effective_date");

-- CreateIndex
CREATE INDEX "EnrollmentAction_status_effective_date_idx" ON "EnrollmentAction"("status", "effective_date");

-- CreateIndex
CREATE INDEX "EnrollmentAction_source_enrollment_id_idx" ON "EnrollmentAction"("source_enrollment_id");

-- CreateIndex
CREATE INDEX "EnrollmentAction_correction_of_id_idx" ON "EnrollmentAction"("correction_of_id");

-- AddForeignKey
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_source_enrollment_id_fkey" FOREIGN KEY ("source_enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAction" ADD CONSTRAINT "EnrollmentAction_correction_of_id_fkey" FOREIGN KEY ("correction_of_id") REFERENCES "EnrollmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Capacity is information for this operational flow. Keep the existing archived-class guard.
CREATE OR REPLACE FUNCTION "lazuli_assert_enrollment_row"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  class_status "ClassStatus";
BEGIN
  IF NEW."deleted_at" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT "status" INTO class_status
  FROM "Class"
  WHERE "id" = NEW."class_id" AND "deleted_at" IS NULL;

  IF class_status = 'ARCHIVED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_class_not_archived_check',
      MESSAGE = 'Enrollment_class_not_archived_check: cannot create or move an enrollment into an archived class.';
  END IF;

  RETURN NEW;
END;
$$;
