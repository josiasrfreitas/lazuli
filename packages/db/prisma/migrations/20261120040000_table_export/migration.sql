ALTER TYPE "ArtifactKind" ADD VALUE 'TABLE_XLSX';
ALTER TABLE "generated_artifacts" ADD COLUMN "export_request" JSONB;
