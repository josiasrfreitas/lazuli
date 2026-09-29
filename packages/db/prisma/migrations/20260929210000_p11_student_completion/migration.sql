-- Nullable command metadata preserves existing students and enables safe wizard retries.
ALTER TABLE "Student"
  ADD COLUMN "command_id" UUID,
  ADD COLUMN "command_fingerprint" TEXT;

CREATE UNIQUE INDEX "Student_command_id_key" ON "Student"("command_id");
