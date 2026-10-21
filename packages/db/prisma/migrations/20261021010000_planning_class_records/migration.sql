CREATE TABLE "ActivityEvent" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_id" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "actor_name" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" UUID,
  "subject_name" TEXT NOT NULL,
  "description" TEXT,
  "deduplication_key" TEXT,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityEvent_deduplication_key_key" ON "ActivityEvent"("deduplication_key");
CREATE INDEX "ActivityEvent_occurred_at_id_idx" ON "ActivityEvent"("occurred_at", "id");
CREATE INDEX "ActivityEvent_area_occurred_at_idx" ON "ActivityEvent"("area", "occurred_at");
CREATE INDEX "ActivityEvent_actor_id_occurred_at_idx" ON "ActivityEvent"("actor_id", "occurred_at");


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


-- Revision history follows the common record lifecycle; the application exposes no rewrite/delete.
ALTER TABLE "StagePlanRevision" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "StagePlanRevision" ALTER COLUMN "updated_at" DROP DEFAULT;


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
