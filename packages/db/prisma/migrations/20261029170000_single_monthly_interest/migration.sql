-- Pre-production: use one monthly rate, prorated daily on a 30-day basis.
UPDATE "FinanceSettings" SET "interest_rate_pct_monthly" = 2;
UPDATE "Contract" SET "interest_rate_pct_monthly" = 2;

ALTER TABLE "FinanceSettings"
  ALTER COLUMN "interest_rate_pct_monthly" SET DEFAULT 2,
  DROP COLUMN "interest_rate_pct_daily";

ALTER TABLE "Contract" DROP CONSTRAINT "Contract_creation_payload_check";
ALTER TABLE "Contract"
  ALTER COLUMN "interest_rate_pct_monthly" SET DEFAULT 2,
  DROP COLUMN "interest_rate_pct_daily";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_creation_payload_check" CHECK (
  "command_id" IS NULL OR (
    "command_fingerprint" IS NOT NULL AND "agreed_on" IS NOT NULL AND
    "starts_on" IS NOT NULL AND "duration_months" > 0 AND "ends_on" IS NOT NULL AND
    ("monthly_amount_cents" > 0 OR ("monthly_amount_cents" = 0 AND "scholarship_pct" = 100)) AND
    "tuition_ceiling_cents" > 0 AND "maximum_discount_pct" IS NOT NULL AND
    "punctuality_discount_pct" IS NOT NULL AND
    "interest_rate_pct_monthly" IS NOT NULL AND "cancellation_fee_pct" IS NOT NULL
  )
);
