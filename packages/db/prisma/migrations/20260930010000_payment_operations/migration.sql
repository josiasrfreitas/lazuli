ALTER TABLE "InstallmentAdjustment" ADD COLUMN "effective_date" DATE;
ALTER TABLE "PaymentEntry" ADD COLUMN "operation_id" UUID, ADD COLUMN "operation_fingerprint" TEXT;
CREATE INDEX "PaymentEntry_operation_id_idx" ON "PaymentEntry"("operation_id");
