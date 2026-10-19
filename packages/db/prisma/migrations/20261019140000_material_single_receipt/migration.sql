-- The school's single receivable is distinct from the customer's card terms.
ALTER TABLE "FinanceSettings"
  ADD COLUMN "material_card_fee_pct" DECIMAL(7,4) NOT NULL DEFAULT 10
  CHECK ("material_card_fee_pct" BETWEEN 0 AND 100);
UPDATE "FinanceSettings" SET "material_card_fee_pct" = "material_cash_discount_pct";
ALTER TABLE "MaterialOrder"
  ADD COLUMN "charged_amount_cents" INTEGER,
  ADD COLUMN "card_fee_pct" DECIMAL(7,4),
  ADD COLUMN "card_fee_cents" INTEGER,
  ADD CONSTRAINT "material_card_terms_valid" CHECK (
    ("charged_amount_cents" IS NULL AND "card_fee_pct" IS NULL AND "card_fee_cents" IS NULL)
    OR ("charged_amount_cents" IS NOT NULL AND "card_fee_pct" IS NOT NULL AND "card_fee_cents" IS NOT NULL
      AND "charged_amount_cents" > 0 AND "card_fee_pct" BETWEEN 0 AND 100
      AND "card_fee_cents" >= 0 AND "card_fee_cents" < "charged_amount_cents")
  );

-- Consolidate only untouched drafts. Paid/adjusted history is never rewritten.
CREATE TEMP TABLE material_receipt_drafts AS
SELECT m.order_id,
  (SELECT i.id FROM "Installment" i WHERE i.order_id = m.order_id AND i.deleted_at IS NULL
   ORDER BY i.sequence_number LIMIT 1) AS first_installment_id,
  round(m.list_price_cents * (1 - m.cash_discount_pct / 100))::integer AS net_cents
FROM "MaterialOrder" m JOIN "Order" o ON o.id = m.order_id
WHERE o.deleted_at IS NULL AND o.cancelled_at IS NULL AND o.first_due_date IS NOT NULL
  AND round(m.list_price_cents * (1 - m.cash_discount_pct / 100)) > 0
  AND EXISTS (SELECT 1 FROM "Installment" i WHERE i.order_id = o.id AND i.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "Installment" i WHERE i.order_id = o.id AND (
      i.waived_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM "PaymentAllocation" a WHERE a.installment_id = i.id)
      OR EXISTS (SELECT 1 FROM "InstallmentAdjustment" a WHERE a.installment_id = i.id)
      OR EXISTS (SELECT 1 FROM "InstallmentAgreement" a WHERE a.installment_id = i.id)
    )
  );
UPDATE "MaterialOrder" m SET
  charged_amount_cents = CASE WHEN m.payment = 'CASH' THEN d.net_cents ELSE m.list_price_cents END,
  card_fee_pct = CASE WHEN m.payment = 'CASH' THEN 0 ELSE m.cash_discount_pct END,
  card_fee_cents = CASE WHEN m.payment = 'CASH' THEN 0 ELSE m.list_price_cents - d.net_cents END
FROM material_receipt_drafts d WHERE m.order_id = d.order_id;
UPDATE "Order" o SET principal_amount_cents = d.net_cents, installment_count = 1
FROM material_receipt_drafts d WHERE o.id = d.order_id;
UPDATE "Installment" i SET amount_cents = d.net_cents, due_date = o.first_due_date
FROM material_receipt_drafts d JOIN "Order" o ON o.id = d.order_id
WHERE i.id = d.first_installment_id;
UPDATE "Installment" i SET deleted_at = CURRENT_TIMESTAMP
FROM material_receipt_drafts d
WHERE i.order_id = d.order_id AND i.id <> d.first_installment_id AND i.deleted_at IS NULL;
DROP TABLE material_receipt_drafts;
