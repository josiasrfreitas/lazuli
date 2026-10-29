-- Student and lead time preferences no longer participate in enrollment or class organization.
ALTER TABLE "SemesterPlacement" DROP COLUMN "availability_id";
DROP TABLE "StudentAvailability";
DROP TABLE "AdmissionAvailability";
ALTER TABLE "AdmissionCandidate"
  DROP COLUMN "available_until",
  DROP COLUMN "availability_confirmed_at";
