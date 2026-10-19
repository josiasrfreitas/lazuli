ALTER TABLE "AttendanceDeclaration" ADD COLUMN "browser_hash" TEXT;
CREATE UNIQUE INDEX "AttendanceDeclaration_class_session_id_browser_hash_key" ON "AttendanceDeclaration"("class_session_id", "browser_hash");

CREATE TABLE "AttendanceProjection" (
  "id" UUID NOT NULL,
  "class_session_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "attendance_token" TEXT,
  "window_expires_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AttendanceProjection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceProjection_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceProjection_class_session_id_key" ON "AttendanceProjection"("class_session_id");
CREATE UNIQUE INDEX "AttendanceProjection_token_hash_key" ON "AttendanceProjection"("token_hash");

CREATE TABLE "AttendanceSettings" (
  "id" TEXT NOT NULL DEFAULT 'school',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radius_meters" INTEGER NOT NULL DEFAULT 100,
  "max_accuracy_meters" INTEGER NOT NULL DEFAULT 50,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "updated_by_id" UUID NOT NULL,
  CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceSettings_coordinates_check" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180),
  CONSTRAINT "AttendanceSettings_area_check" CHECK ("radius_meters" BETWEEN 10 AND 1000 AND "max_accuracy_meters" BETWEEN 5 AND 500)
);

CREATE TYPE "AssessmentFileStatus" AS ENUM ('UPLOADING', 'RECEIVED', 'PROCESSING', 'READY', 'FAILED', 'REJECTED', 'REMOVED');
CREATE TABLE "AssessmentFile" (
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
  CONSTRAINT "AssessmentFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentFile_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "StageAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentFile_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "PedagogicalAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentFile_byte_length_check" CHECK ("byte_length" > 0 AND "byte_length" <= 20971520)
);
CREATE UNIQUE INDEX "AssessmentFile_key_key" ON "AssessmentFile"("key");
CREATE INDEX "AssessmentFile_assessment_id_phase_idx" ON "AssessmentFile"("assessment_id", "phase");
CREATE INDEX "AssessmentFile_appointment_id_idx" ON "AssessmentFile"("appointment_id");
CREATE INDEX "AssessmentFile_status_updated_at_idx" ON "AssessmentFile"("status", "updated_at");
CREATE INDEX "AssessmentFile_uploaded_by_id_idx" ON "AssessmentFile"("uploaded_by_id");
