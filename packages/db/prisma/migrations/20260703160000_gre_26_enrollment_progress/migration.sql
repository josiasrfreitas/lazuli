-- CreateEnum
CREATE TYPE "EnrollmentExitReason" AS ENUM ('COMPLETED', 'TRANSFERRED', 'DROPPED', 'SUSPENDED', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ProgressEndReason" AS ENUM ('ADVANCED', 'TRANSFERRED', 'DROPPED', 'SUSPENDED', 'CORRECTION');

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "exit_date" DATE,
    "exit_reason" "EnrollmentExitReason",
    "capacity_override_reason" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalProgress" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "enrollment_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "end_reason" "ProgressEndReason",

    CONSTRAINT "PedagogicalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enrollment_student_id_idx" ON "Enrollment"("student_id");

-- CreateIndex
CREATE INDEX "Enrollment_class_id_idx" ON "Enrollment"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_active_student_class_key"
ON "Enrollment"("student_id", "class_id")
WHERE ("exit_date" IS NULL AND "deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "PedagogicalProgress_enrollment_id_idx" ON "PedagogicalProgress"("enrollment_id");

-- CreateIndex
CREATE INDEX "PedagogicalProgress_stage_id_idx" ON "PedagogicalProgress"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalProgress_active_enrollment_key"
ON "PedagogicalProgress"("enrollment_id")
WHERE ("end_date" IS NULL AND "deleted_at" IS NULL);

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint (TECHNICAL_SPEC §4.5): exit date and reason move together.
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_exit_date_reason_consistency_check"
CHECK (
  ("exit_date" IS NULL AND "exit_reason" IS NULL)
  OR ("exit_date" IS NOT NULL AND "exit_reason" IS NOT NULL AND "exit_date" >= "entry_date")
);

-- AddCheckConstraint (TECHNICAL_SPEC §4.5): progress end date and reason move together.
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_end_date_reason_consistency_check"
CHECK (
  ("end_date" IS NULL AND "end_reason" IS NULL)
  OR ("end_date" IS NOT NULL AND "end_reason" IS NOT NULL AND "end_date" >= "start_date")
);

-- AddExclusionConstraint (TECHNICAL_SPEC §4.5): progress windows for one
-- enrollment must not overlap. The UUID equality operator class is supplied by
-- btree_gist; Cloud SQL Postgres supports this extension.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_no_overlap_excl"
EXCLUDE USING gist (
  "enrollment_id" WITH =,
  daterange("start_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
)
WHERE ("deleted_at" IS NULL);

CREATE FUNCTION "lazuli_allow_legacy_enrollment"()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('lazuli.allow_legacy_enrollment', true), '') = 'on';
$$;

CREATE FUNCTION "lazuli_assert_enrollment_row"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  class_record record;
  active_enrollment_count integer;
BEGIN
  IF NEW."deleted_at" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT "status", "capacity"
  INTO class_record
  FROM "Class"
  WHERE "id" = NEW."class_id"
    AND "deleted_at" IS NULL;

  IF class_record."status" = 'ARCHIVED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_class_not_archived_check',
      MESSAGE = 'Enrollment_class_not_archived_check: cannot create or move an enrollment into an archived class.';
  END IF;

  IF NEW."exit_date" IS NULL THEN
    SELECT COUNT(*) + 1
    INTO active_enrollment_count
    FROM "Enrollment"
    WHERE "class_id" = NEW."class_id"
      AND "exit_date" IS NULL
      AND "deleted_at" IS NULL
      AND "id" <> NEW."id";

    IF active_enrollment_count > class_record."capacity"
      AND NULLIF(BTRIM(COALESCE(NEW."capacity_override_reason", '')), '') IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'Enrollment_capacity_override_required_check',
        MESSAGE = 'Enrollment_capacity_override_required_check: active enrollment count exceeds class capacity; capacityOverrideReason is required.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Enrollment_row_guard"
BEFORE INSERT OR UPDATE ON "Enrollment"
FOR EACH ROW
EXECUTE FUNCTION "lazuli_assert_enrollment_row"();

CREATE FUNCTION "lazuli_assert_progress_row"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  context record;
BEGIN
  IF NEW."deleted_at" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    e."entry_date",
    e."exit_date",
    c."schedule_type",
    c."shared_stage_id",
    t."status" AS "track_status"
  INTO context
  FROM "Enrollment" e
  JOIN "Class" c ON c."id" = e."class_id"
  JOIN "Stage" s ON s."id" = NEW."stage_id"
  JOIN "Track" t ON t."id" = s."track_id"
  WHERE e."id" = NEW."enrollment_id"
    AND e."deleted_at" IS NULL
    AND c."deleted_at" IS NULL
    AND s."deleted_at" IS NULL
    AND t."deleted_at" IS NULL;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF context."track_status" = 'LEGACY' AND NOT "lazuli_allow_legacy_enrollment"() THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'PedagogicalProgress_legacy_track_blocked_check',
        MESSAGE = 'PedagogicalProgress_legacy_track_blocked_check: cannot create new progress on a legacy track without the legacy enrollment override flag.';
    ELSIF NEW."stage_id" IS DISTINCT FROM OLD."stage_id"
      OR NEW."enrollment_id" IS DISTINCT FROM OLD."enrollment_id" THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'PedagogicalProgress_legacy_track_blocked_check',
        MESSAGE = 'PedagogicalProgress_legacy_track_blocked_check: cannot create new progress on a legacy track without the legacy enrollment override flag.';
    END IF;
  END IF;

  IF NEW."start_date" < context."entry_date"
    OR (
      context."exit_date" IS NOT NULL
      AND COALESCE(NEW."end_date", 'infinity'::date) > context."exit_date"
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'PedagogicalProgress_within_enrollment_window_check',
      MESSAGE = 'PedagogicalProgress_within_enrollment_window_check: pedagogical progress window must stay inside the enrollment window.';
  END IF;

  IF NEW."end_date" IS NULL
    AND context."schedule_type" = 'REGULAR'
    AND NEW."stage_id" IS DISTINCT FROM context."shared_stage_id" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'PedagogicalProgress_regular_stage_match_check',
      MESSAGE = 'PedagogicalProgress_regular_stage_match_check: active progress for a regular class must match the class shared stage.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "PedagogicalProgress_row_guard"
BEFORE INSERT OR UPDATE ON "PedagogicalProgress"
FOR EACH ROW
EXECUTE FUNCTION "lazuli_assert_progress_row"();

CREATE FUNCTION "lazuli_assert_enrollment_progress_state"(target_enrollment_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  enrollment_record record;
  active_progress_count integer;
  active_track_id uuid;
BEGIN
  SELECT "id", "student_id", "exit_date"
  INTO enrollment_record
  FROM "Enrollment"
  WHERE "id" = target_enrollment_id
    AND "deleted_at" IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO active_progress_count
  FROM "PedagogicalProgress"
  WHERE "enrollment_id" = enrollment_record."id"
    AND "end_date" IS NULL
    AND "deleted_at" IS NULL;

  IF enrollment_record."exit_date" IS NULL AND active_progress_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_active_progress_required_check',
      MESSAGE = 'Enrollment_active_progress_required_check: an active enrollment must have exactly one active pedagogical progress row.';
  END IF;

  IF enrollment_record."exit_date" IS NOT NULL AND active_progress_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_closed_progress_absent_check',
      MESSAGE = 'Enrollment_closed_progress_absent_check: a closed enrollment must not have active pedagogical progress.';
  END IF;

  IF enrollment_record."exit_date" IS NOT NULL OR active_progress_count = 0 THEN
    RETURN;
  END IF;

  SELECT s."track_id"
  INTO active_track_id
  FROM "PedagogicalProgress" pp
  JOIN "Stage" s ON s."id" = pp."stage_id"
  WHERE pp."enrollment_id" = enrollment_record."id"
    AND pp."end_date" IS NULL
    AND pp."deleted_at" IS NULL
    AND s."deleted_at" IS NULL;

  IF EXISTS (
    SELECT 1
    FROM "Enrollment" other_enrollment
    JOIN "PedagogicalProgress" other_progress
      ON other_progress."enrollment_id" = other_enrollment."id"
      AND other_progress."end_date" IS NULL
      AND other_progress."deleted_at" IS NULL
    JOIN "Stage" other_stage
      ON other_stage."id" = other_progress."stage_id"
      AND other_stage."deleted_at" IS NULL
    WHERE other_enrollment."student_id" = enrollment_record."student_id"
      AND other_enrollment."id" <> enrollment_record."id"
      AND other_enrollment."exit_date" IS NULL
      AND other_enrollment."deleted_at" IS NULL
      AND other_stage."track_id" = active_track_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_active_student_track_key',
      MESSAGE = 'Enrollment_active_student_track_key: a student may have only one active enrollment per active track.';
  END IF;
END;
$$;

CREATE FUNCTION "lazuli_assert_enrollment_progress_state_trigger"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."id" IS DISTINCT FROM NEW."id" THEN
    PERFORM "lazuli_assert_enrollment_progress_state"(OLD."id");
  END IF;

  PERFORM "lazuli_assert_enrollment_progress_state"(NEW."id");
  RETURN NEW;
END;
$$;

CREATE FUNCTION "lazuli_assert_progress_enrollment_state_trigger"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."enrollment_id" IS DISTINCT FROM NEW."enrollment_id" THEN
    PERFORM "lazuli_assert_enrollment_progress_state"(OLD."enrollment_id");
  END IF;

  PERFORM "lazuli_assert_enrollment_progress_state"(NEW."enrollment_id");
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Enrollment_progress_state_guard"
AFTER INSERT OR UPDATE ON "Enrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "lazuli_assert_enrollment_progress_state_trigger"();

CREATE CONSTRAINT TRIGGER "PedagogicalProgress_enrollment_state_guard"
AFTER INSERT OR UPDATE ON "PedagogicalProgress"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "lazuli_assert_progress_enrollment_state_trigger"();
