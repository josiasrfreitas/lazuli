-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_renewed_from_id_fkey";

-- DropForeignKey
ALTER TABLE "SemesterClassPlan" DROP CONSTRAINT "SemesterClassPlan_source_class_id_fkey";

-- CreateTable
CREATE TABLE "EntryVisitCorrectedFile" (
    "visit_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID NOT NULL,

    CONSTRAINT "EntryVisitCorrectedFile_pkey" PRIMARY KEY ("visit_id")
);

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitCorrectedFile" ADD CONSTRAINT "EntryVisitCorrectedFile_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "EntryVisitAssessment"("visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVisitCorrectedFile" ADD CONSTRAINT "EntryVisitCorrectedFile_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_source_class_id_fkey" FOREIGN KEY ("source_class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
