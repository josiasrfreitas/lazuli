ALTER TABLE "Installment" ADD COLUMN "suspended_until" DATE;
ALTER TABLE "InstallmentAdjustment" ADD COLUMN "charge_only" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "InstallmentAgreement" (
 "id" UUID NOT NULL PRIMARY KEY, "command_id" UUID NOT NULL, "command_fingerprint" TEXT NOT NULL,
 "installment_id" UUID NOT NULL REFERENCES "Installment"("id") ON DELETE RESTRICT,
 "effective_date" DATE NOT NULL, "previous_due_date" DATE NOT NULL, "new_due_date" DATE,
 "previous_charges_cents" INTEGER NOT NULL CHECK ("previous_charges_cents" >= 0),
 "reduction_cents" INTEGER NOT NULL CHECK ("reduction_cents" >= 0 AND "reduction_cents" <= "previous_charges_cents"),
 "previous_balance_cents" INTEGER NOT NULL,
 "reason" TEXT NOT NULL, "actor_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "actor_name" TEXT NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("new_due_date" IS NULL OR "new_due_date" > "effective_date")
);
CREATE UNIQUE INDEX "InstallmentAgreement_command_id_installment_id_key" ON "InstallmentAgreement"("command_id", "installment_id");
CREATE INDEX "InstallmentAgreement_installment_id_created_at_idx" ON "InstallmentAgreement"("installment_id", "created_at");
