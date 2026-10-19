-- A placement can be scheduled before its correcting teacher is assigned.
ALTER TABLE "EntryVisit" DROP CONSTRAINT "EntryVisit_kind_check";
ALTER TABLE "EntryVisit" ADD CONSTRAINT "EntryVisit_kind_check" CHECK (
  (kind::text = 'TRIAL' AND class_id IS NOT NULL AND (schedule_slot_id IS NOT NULL OR class_session_id IS NOT NULL)) OR
  (kind::text = 'INTRODUCTION' AND teacher_id IS NOT NULL AND class_id IS NULL AND schedule_slot_id IS NULL AND class_session_id IS NULL) OR
  (kind::text = 'PLACEMENT' AND class_id IS NULL AND schedule_slot_id IS NULL AND class_session_id IS NULL)
);
