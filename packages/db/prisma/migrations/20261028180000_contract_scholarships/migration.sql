ALTER TABLE "Contract"
  ADD COLUMN "base_monthly_amount_cents" INTEGER,
  ADD COLUMN "standard_punctuality_discount_pct" DECIMAL(7,4),
  ADD COLUMN "scholarship_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "scholarship_agreement" TEXT;

ALTER TABLE "Contract" DROP CONSTRAINT "Contract_creation_payload_check";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_creation_payload_check" CHECK (
  "command_id" IS NULL OR (
    "command_fingerprint" IS NOT NULL AND "agreed_on" IS NOT NULL AND
    "starts_on" IS NOT NULL AND "duration_months" > 0 AND "ends_on" IS NOT NULL AND
    ("monthly_amount_cents" > 0 OR ("monthly_amount_cents" = 0 AND "scholarship_pct" = 100)) AND
    "tuition_ceiling_cents" > 0 AND "maximum_discount_pct" IS NOT NULL AND
    "punctuality_discount_pct" IS NOT NULL AND "interest_rate_pct_daily" IS NOT NULL AND
    "interest_rate_pct_monthly" IS NOT NULL AND "cancellation_fee_pct" IS NOT NULL
  )
);
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_scholarship_check" CHECK (
  "scholarship_pct" BETWEEN 0 AND 100 AND (
    ("scholarship_pct" = 0 AND "scholarship_agreement" IS NULL) OR
    ("scholarship_pct" > 0 AND "base_monthly_amount_cents" IS NOT NULL AND
      "base_monthly_amount_cents" > 0 AND "scholarship_agreement" IS NOT NULL AND
      length(btrim("scholarship_agreement")) BETWEEN 1 AND 5000 AND
      "monthly_amount_cents" IS NOT NULL AND
      "monthly_amount_cents" = round("base_monthly_amount_cents" * (1 - "scholarship_pct" / 100)) AND
      ("scholarship_pct" = 100 OR "monthly_amount_cents" > 0))
  )
);

ALTER TABLE "MaterialOrder"
  ADD COLUMN "scholarship_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "scholarship_agreement" TEXT;
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_scholarship_check" CHECK (
  "scholarship_pct" BETWEEN 0 AND 100 AND (
    ("scholarship_pct" = 0 AND "scholarship_agreement" IS NULL) OR
    ("scholarship_pct" > 0 AND "scholarship_agreement" IS NOT NULL AND
      length(btrim("scholarship_agreement")) BETWEEN 1 AND 5000)
  )
);
ALTER TABLE "Order" DROP CONSTRAINT "Order_principal_amount_cents_positive_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_principal_amount_cents_positive_check" CHECK (
  "principal_amount_cents" > 0 OR
  ("principal_amount_cents" = 0 AND "kind" = 'MATERIAL' AND "installment_count" = 0 AND "contract_id" IS NOT NULL)
);
ALTER TABLE "MaterialOrder" DROP CONSTRAINT "material_card_terms_valid";
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "material_card_terms_valid" CHECK (
  (charged_amount_cents IS NULL AND card_fee_pct IS NULL AND card_fee_cents IS NULL) OR
  (charged_amount_cents IS NOT NULL AND card_fee_pct IS NOT NULL AND card_fee_cents IS NOT NULL AND
    card_fee_pct BETWEEN 0 AND 100 AND card_fee_cents >= 0 AND
    ((charged_amount_cents > 0 AND card_fee_cents < charged_amount_cents) OR
      (charged_amount_cents = 0 AND card_fee_cents = 0 AND scholarship_pct = 100)))
);
