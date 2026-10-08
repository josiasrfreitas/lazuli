CREATE UNIQUE INDEX "EnrollmentAction_one_scheduled_close_per_enrollment"
ON "EnrollmentAction"("enrollment_id")
WHERE "status" = 'SCHEDULED' AND "kind" IN ('PAUSE', 'EXIT');

CREATE UNIQUE INDEX "EnrollmentAction_one_return_per_source"
ON "EnrollmentAction"("source_enrollment_id")
WHERE "kind" = 'RETURN' AND "status" IN ('SCHEDULED', 'APPLIED');
