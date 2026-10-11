-- CreateEnum
CREATE TYPE "OccurrenceCategory" AS ENUM ('MATERIAL', 'HOMEWORK', 'PARTICIPATION', 'BEHAVIOR', 'LEARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CONCLUDED');

-- CreateTable
CREATE TABLE "PedagogicalOccurrence" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "category" "OccurrenceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "initial_response" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "PedagogicalOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccurrenceRelation" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "OccurrenceRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalIntervention" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "student_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "next_step" TEXT NOT NULL,
    "due_on" DATE,
    "status" "InterventionStatus" NOT NULL DEFAULT 'OPEN',
    "concluded_at" TIMESTAMPTZ,
    "outcome" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PedagogicalIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionOccurrence" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "intervention_id" UUID NOT NULL,
    "occurrence_id" UUID NOT NULL,

    CONSTRAINT "InterventionOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalFollowUp" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "occurrence_id" UUID,
    "intervention_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "PedagogicalFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_student_id_created_at_idx" ON "PedagogicalOccurrence"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_recorded_by_id_created_at_idx" ON "PedagogicalOccurrence"("recorded_by_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalOccurrence_class_session_id_idx" ON "PedagogicalOccurrence"("class_session_id");

-- CreateIndex
CREATE INDEX "OccurrenceRelation_to_id_idx" ON "OccurrenceRelation"("to_id");

-- CreateIndex
CREATE UNIQUE INDEX "OccurrenceRelation_from_id_to_id_key" ON "OccurrenceRelation"("from_id", "to_id");

-- CreateIndex
CREATE INDEX "PedagogicalIntervention_student_id_created_at_idx" ON "PedagogicalIntervention"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalIntervention_teacher_id_status_idx" ON "PedagogicalIntervention"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "PedagogicalIntervention_status_due_on_idx" ON "PedagogicalIntervention"("status", "due_on");

-- CreateIndex
CREATE INDEX "InterventionOccurrence_occurrence_id_idx" ON "InterventionOccurrence"("occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionOccurrence_intervention_id_occurrence_id_key" ON "InterventionOccurrence"("intervention_id", "occurrence_id");

-- CreateIndex
CREATE INDEX "PedagogicalFollowUp_occurrence_id_created_at_idx" ON "PedagogicalFollowUp"("occurrence_id", "created_at");

-- CreateIndex
CREATE INDEX "PedagogicalFollowUp_intervention_id_created_at_idx" ON "PedagogicalFollowUp"("intervention_id", "created_at");

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalOccurrence" ADD CONSTRAINT "PedagogicalOccurrence_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOccurrence" ADD CONSTRAINT "InterventionOccurrence_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "PedagogicalIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOccurrence" ADD CONSTRAINT "InterventionOccurrence_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "PedagogicalIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Undirected links are stored once in UUID order, never to themselves.
ALTER TABLE "OccurrenceRelation" ADD CONSTRAINT "OccurrenceRelation_order_check" CHECK ("from_id" < "to_id");
ALTER TABLE "PedagogicalFollowUp" ADD CONSTRAINT "PedagogicalFollowUp_subject_check" CHECK (("occurrence_id" IS NULL) <> ("intervention_id" IS NULL));
ALTER TABLE "PedagogicalIntervention" ADD CONSTRAINT "PedagogicalIntervention_conclusion_check" CHECK (("status" = 'CONCLUDED') = ("concluded_at" IS NOT NULL AND "outcome" IS NOT NULL));
