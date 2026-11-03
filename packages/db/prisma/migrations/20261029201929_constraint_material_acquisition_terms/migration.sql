-- The purchase price and the buyer's installment agreement are independent.
ALTER TABLE "MaterialOrder" DROP CONSTRAINT "material_list_price_matches_quote";

-- Keep recorded totals while normalizing existing agreements to the new meaning.
UPDATE "MaterialOrder"
SET "quoted_installments" = CASE WHEN "payment" = 'CASH' OR "scholarship_pct" = 100 THEN 1 ELSE "quoted_installments" END,
    "quoted_installment_cents" = CASE
      WHEN "payment" = 'CASH' OR "scholarship_pct" = 100 THEN "charged_amount_cents"
      ELSE "charged_amount_cents" / "quoted_installments"
    END
WHERE "charged_amount_cents" IS NOT NULL;

ALTER TABLE "MaterialOrder" ADD CONSTRAINT "material_agreed_installments_valid" CHECK (
  "charged_amount_cents" IS NULL OR (
    "quoted_installment_cents" = "charged_amount_cents" / "quoted_installments" AND
    ("payment" <> 'CASH' OR "quoted_installments" = 1) AND
    (("charged_amount_cents" = 0 AND "quoted_installments" = 1) OR
      ("charged_amount_cents" > 0 AND "quoted_installments" <= "charged_amount_cents"))
  )
);
