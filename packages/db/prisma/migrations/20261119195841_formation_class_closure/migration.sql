-- AlterTable
ALTER TABLE "SemesterPlacement" ADD COLUMN     "class_closure_pending" BOOLEAN NOT NULL DEFAULT false;

-- Older dissolutions used the student's change-request fields for the closure.
WITH waiting AS (
  SELECT p.id, (
    SELECT prior.snapshot FROM "SemesterPlacementRevision" prior
    WHERE prior.placement_id = p.id AND prior.version < (
      SELECT max(closed.version) FROM "SemesterPlacementRevision" closed
      WHERE closed.placement_id = p.id AND closed.action = 'CLASS_DISSOLVED'
    ) ORDER BY prior.version DESC LIMIT 1
  ) AS before_closure
  FROM "SemesterPlacement" p
  WHERE p.plan_id IS NULL AND p.continuity = 'CHANGE'
    AND p.continuity_reason = 'Turma desfeita. Aguardando novo encaixe.'
)
UPDATE "SemesterPlacement" p
SET class_closure_pending = true,
    continuity = COALESCE(waiting.before_closure->>'continuity', 'UNDECIDED'),
    continuity_reason = waiting.before_closure->>'continuityReason'
FROM waiting WHERE p.id = waiting.id;
