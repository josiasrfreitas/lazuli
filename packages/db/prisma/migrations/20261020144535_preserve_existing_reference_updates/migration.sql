-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_renewed_from_id_fkey";

-- DropForeignKey
ALTER TABLE "SemesterClassPlan" DROP CONSTRAINT "SemesterClassPlan_source_class_id_fkey";

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SemesterClassPlan" ADD CONSTRAINT "SemesterClassPlan_source_class_id_fkey" FOREIGN KEY ("source_class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
