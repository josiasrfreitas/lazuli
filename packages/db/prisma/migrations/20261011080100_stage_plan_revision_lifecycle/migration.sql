-- Revision history follows the common record lifecycle; the application exposes no rewrite/delete.
ALTER TABLE "StagePlanRevision" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "StagePlanRevision" ALTER COLUMN "updated_at" DROP DEFAULT;
