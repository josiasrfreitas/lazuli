CREATE TYPE "LeadInterest" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "AdmissionCandidate" ADD COLUMN "interest" "LeadInterest" NOT NULL DEFAULT 'UNKNOWN';
