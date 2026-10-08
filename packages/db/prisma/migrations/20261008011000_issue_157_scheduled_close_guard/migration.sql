-- Removing a scheduled close may make a later entry overlap the still-open track.
CREATE FUNCTION "lazuli_assert_cancelled_scheduled_close"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'SCHEDULED'
     AND NEW."status" = 'CANCELLED'
     AND OLD."kind" IN ('PAUSE', 'EXIT') THEN
    PERFORM "lazuli_assert_enrollment_progress_state"(NEW."enrollment_id");
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "EnrollmentAction_cancelled_close_track_guard"
AFTER UPDATE ON "EnrollmentAction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "lazuli_assert_cancelled_scheduled_close"();
