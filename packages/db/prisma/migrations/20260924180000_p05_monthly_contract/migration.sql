ALTER TABLE "Contract"
  ADD COLUMN "command_id" UUID,
  ADD COLUMN "command_fingerprint" TEXT,
  ADD COLUMN "agreed_on" DATE,
  ADD COLUMN "starts_on" DATE,
  ADD COLUMN "duration_months" INTEGER,
  ADD COLUMN "ends_on" DATE,
  ADD COLUMN "monthly_amount_cents" INTEGER,
  ADD COLUMN "tuition_ceiling_cents" INTEGER,
  ADD COLUMN "maximum_discount_pct" DECIMAL(7,4),
  ADD COLUMN "punctuality_discount_pct" DECIMAL(7,4),
  ADD COLUMN "interest_rate_pct_daily" DECIMAL(7,4),
  ADD COLUMN "interest_rate_pct_monthly" DECIMAL(7,4),
  ADD COLUMN "cancellation_fee_pct" DECIMAL(7,4);
CREATE UNIQUE INDEX "Contract_command_id_key" ON "Contract"("command_id");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_creation_payload_check" CHECK (
  "command_id" IS NULL OR (
    "command_fingerprint" IS NOT NULL AND "agreed_on" IS NOT NULL AND
    "starts_on" IS NOT NULL AND "duration_months" > 0 AND "ends_on" IS NOT NULL AND
    "monthly_amount_cents" > 0 AND "tuition_ceiling_cents" > 0 AND
    "maximum_discount_pct" IS NOT NULL AND "punctuality_discount_pct" IS NOT NULL AND
    "interest_rate_pct_daily" IS NOT NULL AND "interest_rate_pct_monthly" IS NOT NULL AND
    "cancellation_fee_pct" IS NOT NULL
  )
);
ALTER TABLE "Order" ADD COLUMN "first_due_date" DATE, ADD COLUMN "installment_count" INTEGER;
