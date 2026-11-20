-- AlterTable
ALTER TABLE "SemesterPlacement" ADD COLUMN     "exit_risk_active" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SemesterPlacementEvent" (
    "id" UUID NOT NULL,
    "placement_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "verbal_report" BOOLEAN,
    "health_score" INTEGER,
    "outcome" TEXT,
    "next_owner" TEXT,
    "reassessment" TEXT,
    "renegotiation_id" UUID,
    "renewal_id" UUID,

    CONSTRAINT "SemesterPlacementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SemesterPlacementEvent_placement_id_created_at_idx" ON "SemesterPlacementEvent"("placement_id", "created_at");

-- AddForeignKey
ALTER TABLE "SemesterPlacementEvent" ADD CONSTRAINT "SemesterPlacementEvent_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "SemesterPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacementEvent" ADD CONSTRAINT "SemesterPlacementEvent_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacementEvent" ADD CONSTRAINT "SemesterPlacementEvent_renegotiation_id_fkey" FOREIGN KEY ("renegotiation_id") REFERENCES "ContractRenegotiation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterPlacementEvent" ADD CONSTRAINT "SemesterPlacementEvent_renewal_id_fkey" FOREIGN KEY ("renewal_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
