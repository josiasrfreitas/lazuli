CREATE TABLE "ClassAppointmentSeries" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "class_id" UUID NOT NULL REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "teacher_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "scheduled_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "from_date" DATE NOT NULL,
  "through_date" DATE NOT NULL,
  "schedule" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  CONSTRAINT "ClassAppointmentSeries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassAppointmentSeries_class_id_idx" ON "ClassAppointmentSeries"("class_id");
ALTER TABLE "ClassSession" ADD COLUMN "appointment_series_id" UUID;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_appointment_series_id_fkey" FOREIGN KEY ("appointment_series_id") REFERENCES "ClassAppointmentSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ClassSession_appointment_series_id_idx" ON "ClassSession"("appointment_series_id");
