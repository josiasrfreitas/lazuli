CREATE TABLE "TeacherProfile" (
  "user_id" UUID NOT NULL PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "cpf" VARCHAR(11) UNIQUE,
  "departure_date" DATE,
  "departure_recorded_at" TIMESTAMPTZ,
  "departure_recorded_by_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeacherProfile_cpf_format" CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')
);
CREATE INDEX "TeacherProfile_departure_date_idx" ON "TeacherProfile"("departure_date");

CREATE TABLE "ClassTeacherAssignment" (
  "id" UUID NOT NULL PRIMARY KEY,
  "class_id" UUID NOT NULL REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "teacher_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "effective_date" DATE NOT NULL,
  "superseded_at" TIMESTAMPTZ,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ClassTeacherAssignment_class_id_effective_date_idx" ON "ClassTeacherAssignment"("class_id", "effective_date");
CREATE UNIQUE INDEX "ClassTeacherAssignment_one_active_date" ON "ClassTeacherAssignment"("class_id", "effective_date") WHERE "superseded_at" IS NULL;
CREATE INDEX "ClassTeacherAssignment_teacher_id_effective_date_idx" ON "ClassTeacherAssignment"("teacher_id", "effective_date");

CREATE UNIQUE INDEX "ClassSession_class_id_id_key" ON "ClassSession"("class_id", "id");

CREATE TABLE "ClassSubstitution" (
  "id" UUID NOT NULL PRIMARY KEY,
  "class_id" UUID NOT NULL,
  "schedule_slot_id" UUID,
  "class_session_id" UUID,
  "date" DATE NOT NULL,
  "teacher_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revoked_at" TIMESTAMPTZ,
  "coverage_resolved_at" TIMESTAMPTZ,
  "revoked_by_id" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSubstitution_meeting_identity" CHECK (("schedule_slot_id" IS NULL) <> ("class_session_id" IS NULL)),
  CONSTRAINT "ClassSubstitution_class_id_class_session_id_fkey" FOREIGN KEY ("class_id", "class_session_id") REFERENCES "ClassSession"("class_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSubstitution_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSubstitution_class_id_schedule_slot_id_fkey" FOREIGN KEY ("class_id", "schedule_slot_id") REFERENCES "ClassScheduleSlot"("class_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassSubstitution_one_active_per_meeting" ON "ClassSubstitution"("class_id", "schedule_slot_id", "date") WHERE "revoked_at" IS NULL;
CREATE INDEX "ClassSubstitution_teacher_id_date_idx" ON "ClassSubstitution"("teacher_id", "date");
CREATE INDEX "ClassSubstitution_class_id_date_idx" ON "ClassSubstitution"("class_id", "date");

CREATE UNIQUE INDEX "ClassSubstitution_one_active_per_session" ON "ClassSubstitution"("class_session_id") WHERE "revoked_at" IS NULL AND "class_session_id" IS NOT NULL;

ALTER TABLE "ClassSession" ADD COLUMN "usual_teacher_id" UUID,
  ADD COLUMN "responsibility_frozen_at" TIMESTAMPTZ;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_usual_teacher_id_fkey"
  FOREIGN KEY ("usual_teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "ClassSession" AS session
SET "usual_teacher_id" = class."teacher_id", "responsibility_frozen_at" = CURRENT_TIMESTAMP
FROM "Class" AS class
WHERE class."id" = session."class_id"
  AND (session."attendance_confirmed_at" IS NOT NULL OR session."attendance_last_committed_at" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "Attendance" AS attendance WHERE attendance."class_session_id" = session."id"));
