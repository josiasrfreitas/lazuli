-- AlterTable
ALTER TABLE "Semester" ADD COLUMN     "formation_risk_limit" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "SemesterClassPlan" ADD COLUMN     "starts_on" DATE;

-- AlterTable
ALTER TABLE "SemesterPlacement" ADD COLUMN     "attention_note" TEXT;

-- CreateTable
CREATE TABLE "UndatedStudentIntake" (
    "student_id" UUID NOT NULL,
    "stage_id" UUID,
    "requested_on" DATE NOT NULL,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "UndatedStudentIntake_pkey" PRIMARY KEY ("student_id")
);

-- AddForeignKey
ALTER TABLE "UndatedStudentIntake" ADD CONSTRAINT "UndatedStudentIntake_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UndatedStudentIntake" ADD CONSTRAINT "UndatedStudentIntake_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UndatedStudentIntake" ADD CONSTRAINT "UndatedStudentIntake_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
