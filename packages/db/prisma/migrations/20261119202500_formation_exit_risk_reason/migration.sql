CREATE TYPE "FormationExitRiskReason" AS ENUM ('FINANCIAL', 'DISINTEREST', 'OTHER');

ALTER TABLE "SemesterPlacementEvent" ADD COLUMN "risk_reason" "FormationExitRiskReason";
