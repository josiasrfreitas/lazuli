ALTER TABLE "FinanceSettings"
  ADD COLUMN "child_material_installments" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "child_material_installment_cents" INTEGER NOT NULL DEFAULT 12300,
  ADD COLUMN "adult_material_installments" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "adult_material_installment_cents" INTEGER NOT NULL DEFAULT 13600,
  ADD COLUMN "material_cash_discount_pct" DECIMAL(7,4) NOT NULL DEFAULT 10,
  ADD CONSTRAINT "book_pricing_positive_installments" CHECK ("child_material_installments" > 0 AND "adult_material_installments" > 0),
  ADD CONSTRAINT "book_pricing_nonnegative_amounts" CHECK ("child_material_installment_cents" >= 0 AND "adult_material_installment_cents" >= 0),
  ADD CONSTRAINT "book_pricing_discount_bounds" CHECK ("material_cash_discount_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "book_pricing_total_bounds" CHECK (
    "child_material_installments"::BIGINT * "child_material_installment_cents" <= 2147483647 AND
    "adult_material_installments"::BIGINT * "adult_material_installment_cents" <= 2147483647
  );
