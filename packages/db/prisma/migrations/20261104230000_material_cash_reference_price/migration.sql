ALTER TABLE "FinanceSettings"
ADD COLUMN "child_material_cash_price_cents" INTEGER,
ADD COLUMN "adult_material_cash_price_cents" INTEGER,
ADD COLUMN "material_card_fee_rates" JSONB;

UPDATE "FinanceSettings"
SET "child_material_cash_price_cents" = ROUND(
      "child_material_installments"::numeric * "child_material_installment_cents"
      * (1 - "material_card_fee_pct" / 100)
    )::integer,
    "adult_material_cash_price_cents" = ROUND(
      "adult_material_installments"::numeric * "adult_material_installment_cents"
      * (1 - "material_card_fee_pct" / 100)
    )::integer,
    "material_card_fee_rates" = (
      SELECT jsonb_object_agg(series.installment_count::text, "FinanceSettings"."material_card_fee_pct")
      FROM generate_series(1, 12) AS series(installment_count)
    );

ALTER TABLE "FinanceSettings"
ADD CONSTRAINT "book_cash_prices_nonnegative" CHECK (
  ("child_material_cash_price_cents" IS NULL OR "child_material_cash_price_cents" >= 0)
  AND ("adult_material_cash_price_cents" IS NULL OR "adult_material_cash_price_cents" >= 0)
);
