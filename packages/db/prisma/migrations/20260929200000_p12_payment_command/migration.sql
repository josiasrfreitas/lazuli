ALTER TABLE "PaymentEntry" ADD COLUMN "command_id" UUID;
ALTER TABLE "PaymentEntry" ADD COLUMN "command_fingerprint" TEXT;
CREATE UNIQUE INDEX "PaymentEntry_command_id_key" ON "PaymentEntry"("command_id");
