ALTER TABLE "StagePlanItem" ADD COLUMN "planned_session_id" UUID;
CREATE INDEX "StagePlanItem_planned_session_id_idx" ON "StagePlanItem"("planned_session_id");
ALTER TABLE "StagePlanItem" ADD CONSTRAINT "StagePlanItem_planned_session_id_fkey"
FOREIGN KEY ("planned_session_id") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
