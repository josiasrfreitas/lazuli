-- CreateEnum
CREATE TYPE "StagePlanActivityKind" AS ENUM ('CONTENT', 'REVIEW', 'ASSESSMENT', 'ACTIVITY');

-- AlterTable
ALTER TABLE "PedagogicalProgress" ADD COLUMN     "stage_plan_id" UUID;

-- CreateTable
CREATE TABLE "StagePlan" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "class_id" UUID,
    "student_id" UUID,
    "stage_id" UUID NOT NULL,
    "planned_start_on" DATE NOT NULL,
    "planned_end_on" DATE NOT NULL,
    "objective" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "StagePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePlanItem" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "plan_id" UUID NOT NULL,
    "planned_on" DATE NOT NULL,
    "kind" "StagePlanActivityKind" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "page_from" INTEGER,
    "page_to" INTEGER,

    CONSTRAINT "StagePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePlanRevision" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "StagePlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StagePlan_class_id_key" ON "StagePlan"("class_id");

-- CreateIndex
CREATE INDEX "StagePlan_student_id_stage_id_idx" ON "StagePlan"("student_id", "stage_id");

-- CreateIndex
CREATE INDEX "StagePlanItem_plan_id_planned_on_idx" ON "StagePlanItem"("plan_id", "planned_on");

-- CreateIndex
CREATE UNIQUE INDEX "StagePlanRevision_plan_id_version_key" ON "StagePlanRevision"("plan_id", "version");

-- AddForeignKey
ALTER TABLE "PedagogicalProgress" ADD CONSTRAINT "PedagogicalProgress_stage_plan_id_fkey" FOREIGN KEY ("stage_plan_id") REFERENCES "StagePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlanItem" ADD CONSTRAINT "StagePlanItem_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "StagePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlanRevision" ADD CONSTRAINT "StagePlanRevision_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "StagePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlanRevision" ADD CONSTRAINT "StagePlanRevision_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A plan belongs to a shared class OR an individual student stage attempt.
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_owner_check"
  CHECK (("class_id" IS NOT NULL) <> ("student_id" IS NOT NULL));
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_window_check"
  CHECK ("planned_start_on" <= "planned_end_on" AND "version" >= 1);
ALTER TABLE "StagePlanItem" ADD CONSTRAINT "StagePlanItem_pages_check"
  CHECK (("page_from" IS NULL AND "page_to" IS NULL)
    OR ("page_from" IS NOT NULL AND "page_from" >= 1 AND ("page_to" IS NULL OR "page_to" >= "page_from")));
