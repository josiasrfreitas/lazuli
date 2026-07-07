-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM (
  'STUDENT_STATEMENT_PDF',
  'CLASS_ROSTER_PDF',
  'ATTENDANCE_SUMMARY_PDF',
  'OVERDUE_RECEIVABLES_CSV',
  'MONTHLY_ACCOUNTANT_CSV',
  'SIGNED_ORDER_PDF'
);

-- CreateTable
CREATE TABLE "generated_artifacts" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "kind" "ArtifactKind" NOT NULL,
  "requested_by_id" UUID,
  "student_id" UUID,
  "class_id" UUID,
  "order_id" UUID,
  "storage_bucket" TEXT,
  "storage_object" TEXT,
  "content_type" TEXT,
  "file_name" TEXT,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "error_code" TEXT,
  "error_message" TEXT,
  "expires_at" TIMESTAMPTZ,

  CONSTRAINT "generated_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_artifacts_requested_by_id_idx" ON "generated_artifacts"("requested_by_id");

-- CreateIndex
CREATE INDEX "generated_artifacts_student_id_idx" ON "generated_artifacts"("student_id");

-- CreateIndex
CREATE INDEX "generated_artifacts_class_id_idx" ON "generated_artifacts"("class_id");

-- CreateIndex
CREATE INDEX "generated_artifacts_order_id_idx" ON "generated_artifacts"("order_id");

-- CreateIndex
CREATE INDEX "generated_artifacts_kind_idx" ON "generated_artifacts"("kind");

-- AddForeignKey
ALTER TABLE "generated_artifacts"
ADD CONSTRAINT "generated_artifacts_requested_by_id_fkey"
FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_artifacts"
ADD CONSTRAINT "generated_artifacts_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_artifacts"
ADD CONSTRAINT "generated_artifacts_class_id_fkey"
FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_artifacts"
ADD CONSTRAINT "generated_artifacts_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
