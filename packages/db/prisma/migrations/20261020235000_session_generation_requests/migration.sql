-- CreateEnum
CREATE TYPE "SessionGenerationStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "SessionGenerationRequest" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_id" UUID,
    "semester_id" UUID,
    "requested_by_id" UUID,
    "status" "SessionGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "job_id" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "failure_code" TEXT,
    "classes_matched" INTEGER,
    "sessions_created" INTEGER,
    "sessions_planned" INTEGER,

    CONSTRAINT "SessionGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionGenerationRequest_class_id_created_at_idx" ON "SessionGenerationRequest"("class_id", "created_at");

-- CreateIndex
CREATE INDEX "SessionGenerationRequest_semester_id_created_at_idx" ON "SessionGenerationRequest"("semester_id", "created_at");

-- CreateIndex
CREATE INDEX "SessionGenerationRequest_requested_by_id_idx" ON "SessionGenerationRequest"("requested_by_id");

-- AddForeignKey
ALTER TABLE "SessionGenerationRequest" ADD CONSTRAINT "SessionGenerationRequest_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionGenerationRequest" ADD CONSTRAINT "SessionGenerationRequest_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionGenerationRequest" ADD CONSTRAINT "SessionGenerationRequest_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionGenerationRequest"
  ADD CONSTRAINT "SessionGenerationRequest_scope" CHECK (("class_id" IS NULL) <> ("semester_id" IS NULL)),
  ADD CONSTRAINT "SessionGenerationRequest_counts" CHECK (
    ("classes_matched" IS NULL OR "classes_matched" >= 0) AND
    ("sessions_created" IS NULL OR "sessions_created" >= 0) AND
    ("sessions_planned" IS NULL OR "sessions_planned" >= "sessions_created")
  );
