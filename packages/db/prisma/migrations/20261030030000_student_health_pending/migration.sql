CREATE TABLE "StudentHealthPending" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "student_id" UUID NOT NULL,
  "score" INTEGER,
  "opened_at" TIMESTAMPTZ,
  "recovered_at" TIMESTAMPTZ,
  "evaluated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StudentHealthPending_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentHealthPending_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentHealthPending_score_range" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  CONSTRAINT "StudentHealthPending_recovery_requires_open" CHECK ("recovered_at" IS NULL OR "opened_at" IS NOT NULL)
);
CREATE UNIQUE INDEX "StudentHealthPending_student_id_key" ON "StudentHealthPending"("student_id");
CREATE INDEX "StudentHealthPending_opened_at_recovered_at_idx" ON "StudentHealthPending"("opened_at", "recovered_at");
