-- Occurrence addenda are retired; follow-ups now belong exclusively to interventions.
DELETE FROM "PedagogicalFollowUp" WHERE "occurrence_id" IS NOT NULL;
ALTER TABLE "PedagogicalFollowUp" DROP CONSTRAINT "PedagogicalFollowUp_subject_check";
ALTER TABLE "PedagogicalFollowUp" DROP CONSTRAINT "PedagogicalFollowUp_occurrence_id_fkey";
DROP INDEX "PedagogicalFollowUp_occurrence_id_created_at_idx";
ALTER TABLE "PedagogicalFollowUp" DROP COLUMN "occurrence_id";
ALTER TABLE "PedagogicalFollowUp" ALTER COLUMN "intervention_id" SET NOT NULL;
