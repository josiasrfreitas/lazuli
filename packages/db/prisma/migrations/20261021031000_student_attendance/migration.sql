-- CreateTable
CREATE TABLE "AttendanceWindow" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "opened_by_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "closed_by_id" UUID,
    "reference_latitude" DOUBLE PRECISION,
    "reference_longitude" DOUBLE PRECISION,
    "radius_meters" INTEGER,
    "max_accuracy_meters" INTEGER,

    CONSTRAINT "AttendanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDeclaration" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_session_id" UUID NOT NULL,
    "window_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "declared_name" TEXT NOT NULL,
    "match_kind" TEXT NOT NULL,
    "browser_hash" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "captured_at" TIMESTAMPTZ,

    CONSTRAINT "AttendanceDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceProjection" (
    "id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "window_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AttendanceProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'school',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "max_accuracy_meters" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceWindow_token_hash_key" ON "AttendanceWindow"("token_hash");

-- CreateIndex
CREATE INDEX "AttendanceWindow_class_session_id_opened_at_idx" ON "AttendanceWindow"("class_session_id", "opened_at");

-- CreateIndex
CREATE INDEX "AttendanceWindow_opened_by_id_idx" ON "AttendanceWindow"("opened_by_id");

-- CreateIndex
CREATE INDEX "AttendanceWindow_closed_by_id_idx" ON "AttendanceWindow"("closed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceWindow_class_session_id_id_key" ON "AttendanceWindow"("class_session_id", "id");

-- CreateIndex
CREATE INDEX "AttendanceDeclaration_window_id_idx" ON "AttendanceDeclaration"("window_id");

-- CreateIndex
CREATE INDEX "AttendanceDeclaration_enrollment_id_idx" ON "AttendanceDeclaration"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeclaration_class_session_id_enrollment_id_key" ON "AttendanceDeclaration"("class_session_id", "enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeclaration_class_session_id_browser_hash_key" ON "AttendanceDeclaration"("class_session_id", "browser_hash");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceProjection_class_session_id_key" ON "AttendanceProjection"("class_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceProjection_token_hash_key" ON "AttendanceProjection"("token_hash");

-- AddForeignKey
ALTER TABLE "AttendanceWindow" ADD CONSTRAINT "AttendanceWindow_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWindow" ADD CONSTRAINT "AttendanceWindow_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWindow" ADD CONSTRAINT "AttendanceWindow_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeclaration" ADD CONSTRAINT "AttendanceDeclaration_class_session_id_window_id_fkey" FOREIGN KEY ("class_session_id", "window_id") REFERENCES "AttendanceWindow"("class_session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeclaration" ADD CONSTRAINT "AttendanceDeclaration_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeclaration" ADD CONSTRAINT "AttendanceDeclaration_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceProjection" ADD CONSTRAINT "AttendanceProjection_class_session_id_window_id_fkey" FOREIGN KEY ("class_session_id", "window_id") REFERENCES "AttendanceWindow"("class_session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceProjection" ADD CONSTRAINT "AttendanceProjection_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSettings" ADD CONSTRAINT "AttendanceSettings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validity, campus criteria and evidence belong to the stored encounter/window.
ALTER TABLE "AttendanceSettings" ADD CONSTRAINT "AttendanceSettings_bounds_check" CHECK (
  "id" = 'school' AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
  AND "radius_meters" BETWEEN 10 AND 1000 AND "max_accuracy_meters" BETWEEN 5 AND 500
);
ALTER TABLE "AttendanceWindow" ADD CONSTRAINT "AttendanceWindow_validity_check" CHECK (
  "expires_at" > "opened_at" AND "expires_at" <= "opened_at" + INTERVAL '30 minutes'
  AND ("format" <> 'IN_PERSON' OR "expires_at" <= "opened_at" + INTERVAL '5 minutes')
  AND ("closed_at" IS NULL) = ("closed_by_id" IS NULL)
);
ALTER TABLE "AttendanceWindow" ADD CONSTRAINT "AttendanceWindow_campus_check" CHECK (
  ("format" = 'ONLINE' AND "reference_latitude" IS NULL AND "reference_longitude" IS NULL AND "radius_meters" IS NULL AND "max_accuracy_meters" IS NULL)
  OR ("format" = 'IN_PERSON' AND "reference_latitude" IS NOT NULL AND "reference_longitude" IS NOT NULL AND "radius_meters" IS NOT NULL AND "max_accuracy_meters" IS NOT NULL
      AND "reference_latitude" BETWEEN -90 AND 90 AND "reference_longitude" BETWEEN -180 AND 180
      AND "radius_meters" BETWEEN 10 AND 1000 AND "max_accuracy_meters" BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AttendanceWindow_one_open_per_session" ON "AttendanceWindow" ("class_session_id") WHERE "closed_at" IS NULL AND "deleted_at" IS NULL;
ALTER TABLE "AttendanceDeclaration" ADD CONSTRAINT "AttendanceDeclaration_evidence_check" CHECK (
  "match_kind" IN ('EXACT', 'SELECTED')
  AND (("latitude" IS NULL AND "longitude" IS NULL AND "accuracy" IS NULL AND "captured_at" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "accuracy" IS NOT NULL AND "captured_at" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "accuracy" BETWEEN 0 AND 100000))
);
