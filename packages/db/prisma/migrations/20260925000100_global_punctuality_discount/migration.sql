ALTER TABLE "FinanceSettings"
  ADD COLUMN "punctuality_discount_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "FinanceSettings_punctuality_discount_range"
    CHECK ("punctuality_discount_pct" BETWEEN 0 AND 100);
