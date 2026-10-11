CREATE TABLE "AttendanceWindow" (
  "id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL, "deleted_at" TIMESTAMPTZ,
  "class_session_id" UUID NOT NULL, "token_hash" TEXT NOT NULL, "format" "ClassFormat" NOT NULL,
  "opened_at" TIMESTAMPTZ NOT NULL, "expires_at" TIMESTAMPTZ NOT NULL,
  "opened_by_id" UUID NOT NULL, "closed_at" TIMESTAMPTZ, "closed_by_id" UUID,
  "reference_latitude" DOUBLE PRECISION, "reference_longitude" DOUBLE PRECISION, "reference_accuracy" DOUBLE PRECISION,
  CONSTRAINT "AttendanceWindow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceWindow_validity_check" CHECK ("expires_at" > "opened_at"),
  CONSTRAINT "AttendanceWindow_reference_check" CHECK (
    ("reference_latitude" IS NULL AND "reference_longitude" IS NULL AND "reference_accuracy" IS NULL)
    OR ("format" = 'IN_PERSON' AND "reference_latitude" IS NOT NULL AND "reference_longitude" IS NOT NULL AND "reference_accuracy" IS NOT NULL
      AND "reference_latitude" BETWEEN -90 AND 90 AND "reference_longitude" BETWEEN -180 AND 180 AND "reference_accuracy" >= 0)
  ),
  CONSTRAINT "AttendanceWindow_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceWindow_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceWindow_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceWindow_token_hash_key" ON "AttendanceWindow"("token_hash");
CREATE UNIQUE INDEX "AttendanceWindow_class_session_id_id_key" ON "AttendanceWindow"("class_session_id", "id");
CREATE UNIQUE INDEX "AttendanceWindow_one_open" ON "AttendanceWindow"("class_session_id") WHERE "closed_at" IS NULL AND "deleted_at" IS NULL;
CREATE INDEX "AttendanceWindow_class_session_id_opened_at_idx" ON "AttendanceWindow"("class_session_id", "opened_at");
CREATE INDEX "AttendanceWindow_opened_by_id_idx" ON "AttendanceWindow"("opened_by_id");
CREATE INDEX "AttendanceWindow_closed_by_id_idx" ON "AttendanceWindow"("closed_by_id");
CREATE TABLE "AttendanceDeclaration" (
  "id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL, "deleted_at" TIMESTAMPTZ,
  "class_session_id" UUID NOT NULL, "window_id" UUID NOT NULL, "enrollment_id" UUID NOT NULL,
  "declared_name" TEXT NOT NULL, "match_kind" TEXT NOT NULL, "submitted_at" TIMESTAMPTZ NOT NULL,
  "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION, "accuracy" DOUBLE PRECISION, "captured_at" TIMESTAMPTZ,
  CONSTRAINT "AttendanceDeclaration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceDeclaration_match_check" CHECK ("match_kind" IN ('EXACT', 'SELECTED')),
  CONSTRAINT "AttendanceDeclaration_location_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL AND "accuracy" IS NULL AND "captured_at" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "accuracy" IS NOT NULL AND "captured_at" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "accuracy" >= 0)
  ),
  CONSTRAINT "AttendanceDeclaration_class_session_id_window_id_fkey" FOREIGN KEY ("class_session_id", "window_id") REFERENCES "AttendanceWindow"("class_session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceDeclaration_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceDeclaration_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceDeclaration_class_session_id_enrollment_id_key" ON "AttendanceDeclaration"("class_session_id", "enrollment_id");
CREATE INDEX "AttendanceDeclaration_window_id_idx" ON "AttendanceDeclaration"("window_id");
CREATE INDEX "AttendanceDeclaration_enrollment_id_idx" ON "AttendanceDeclaration"("enrollment_id");
