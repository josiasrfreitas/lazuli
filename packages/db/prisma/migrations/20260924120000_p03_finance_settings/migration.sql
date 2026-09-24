ALTER TYPE "UserRole" ADD VALUE 'SYSTEM_ADMIN';
ALTER TABLE "FinanceSettings"
  ADD COLUMN "tuition_ceiling_cents" INTEGER,
  ADD COLUMN "maximum_discount_pct" DECIMAL(7,4),
  ADD COLUMN "interest_rate_pct_daily" DECIMAL(7,4),
  ADD COLUMN "cancellation_fee_pct" DECIMAL(7,4),
  ADD COLUMN "material_price_cents" INTEGER,
  ALTER COLUMN "interest_rate_pct_monthly" DROP DEFAULT,
  ALTER COLUMN "interest_rate_pct_monthly" DROP NOT NULL,
  ALTER COLUMN "interest_rate_pct_monthly" TYPE DECIMAL(7,4);
