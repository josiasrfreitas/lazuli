-- AlterTable
ALTER TABLE "InstallmentAdjustment" ADD COLUMN     "renegotiation_id" UUID;

-- CreateTable
CREATE TABLE "ContractRenegotiation" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "command_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "contract_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "new_amount_cents" INTEGER NOT NULL,
    "reduction_cents" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ContractRenegotiation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenegotiation_command_id_key" ON "ContractRenegotiation"("command_id");

-- CreateIndex
CREATE INDEX "ContractRenegotiation_contract_id_created_at_idx" ON "ContractRenegotiation"("contract_id", "created_at");

-- CreateIndex
CREATE INDEX "InstallmentAdjustment_renegotiation_id_idx" ON "InstallmentAdjustment"("renegotiation_id");

-- AddForeignKey
ALTER TABLE "ContractRenegotiation" ADD CONSTRAINT "ContractRenegotiation_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractRenegotiation" ADD CONSTRAINT "ContractRenegotiation_amounts_check"
CHECK ("new_amount_cents" >= 0 AND "reduction_cents" > 0 AND "installment_count" > 0);

-- AddForeignKey
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_renegotiation_id_fkey" FOREIGN KEY ("renegotiation_id") REFERENCES "ContractRenegotiation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
