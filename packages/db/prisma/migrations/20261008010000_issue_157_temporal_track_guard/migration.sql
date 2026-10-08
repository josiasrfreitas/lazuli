-- Open progress for a future entry must not reserve a track before its entry date.
-- A scheduled pause or exit closes the operational window on its effective date.
CREATE OR REPLACE FUNCTION "lazuli_assert_enrollment_progress_state"(target_enrollment_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  enrollment_record record;
  active_progress_count integer;
  active_track_id uuid;
  target_end_date date;
BEGIN
  SELECT "id", "student_id", "entry_date", "exit_date"
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

  SELECT COALESCE(MIN(a."effective_date"), 'infinity'::date)
  INTO target_end_date
  FROM "EnrollmentAction" a
  WHERE a."enrollment_id" = enrollment_record."id"
    AND a."status" = 'SCHEDULED'
    AND a."kind" IN ('PAUSE', 'EXIT');

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
      AND other_enrollment."entry_date" < target_end_date
      AND enrollment_record."entry_date" < COALESCE((
        SELECT MIN(a."effective_date")
        FROM "EnrollmentAction" a
        WHERE a."enrollment_id" = other_enrollment."id"
          AND a."status" = 'SCHEDULED'
          AND a."kind" IN ('PAUSE', 'EXIT')
      ), 'infinity'::date)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'Enrollment_active_student_track_key',
      MESSAGE = 'Enrollment_active_student_track_key: a student may have only one active enrollment per active track.';
  END IF;
END;
$$;
