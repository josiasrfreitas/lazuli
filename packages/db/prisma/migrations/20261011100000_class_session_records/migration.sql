CREATE TABLE "ClassSessionRecord" (
  "id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL, "deleted_at" TIMESTAMPTZ,
  "class_session_id" UUID NOT NULL, "teaching_teacher_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1, "snapshot" JSONB NOT NULL,
  CONSTRAINT "ClassSessionRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassSessionRecord_version_check" CHECK ("version" > 0),
  CONSTRAINT "ClassSessionRecord_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSessionRecord_teaching_teacher_id_fkey" FOREIGN KEY ("teaching_teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassSessionRecord_class_session_id_key" ON "ClassSessionRecord"("class_session_id");
CREATE INDEX "ClassSessionRecord_teaching_teacher_id_idx" ON "ClassSessionRecord"("teaching_teacher_id");
CREATE TABLE "ClassSessionRecordRevision" (
  "id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL, "deleted_at" TIMESTAMPTZ,
  "record_id" UUID NOT NULL, "version" INTEGER NOT NULL, "reason" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL, "recorded_by_id" UUID NOT NULL,
  CONSTRAINT "ClassSessionRecordRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassSessionRecordRevision_version_check" CHECK ("version" > 0),
  CONSTRAINT "ClassSessionRecordRevision_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ClassSessionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSessionRecordRevision_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassSessionRecordRevision_record_id_version_key" ON "ClassSessionRecordRevision"("record_id", "version");
CREATE INDEX "ClassSessionRecordRevision_recorded_by_id_idx" ON "ClassSessionRecordRevision"("recorded_by_id");
