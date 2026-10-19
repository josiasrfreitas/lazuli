ALTER TABLE "Contract"
  ADD COLUMN "terminated_at" TIMESTAMPTZ,
  ADD COLUMN "termination_command_id" UUID,
  ADD COLUMN "termination_fingerprint" TEXT,
  ADD COLUMN "termination_snapshot" JSONB;
CREATE UNIQUE INDEX "Contract_termination_command_id_key" ON "Contract"("termination_command_id");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_termination_complete_check" CHECK (
  (terminated_at IS NULL AND termination_command_id IS NULL AND termination_fingerprint IS NULL AND termination_snapshot IS NULL)
  OR (terminated_at IS NOT NULL AND termination_command_id IS NOT NULL AND termination_fingerprint IS NOT NULL AND termination_snapshot IS NOT NULL)
);
