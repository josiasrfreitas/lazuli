ALTER TABLE "CalendarReconciliationRequest" ADD COLUMN "confirmation_fingerprint" VARCHAR(64);
ALTER TABLE "CalendarReconciliationRequest" ADD CONSTRAINT "CalendarReconciliationRequest_semester_id_fkey"
FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
