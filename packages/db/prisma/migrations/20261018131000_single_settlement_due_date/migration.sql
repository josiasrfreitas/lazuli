-- A single settlement may be due on the exact day negotiated at termination.
ALTER TABLE "Order" DROP CONSTRAINT "Order_due_day_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_due_day_check" CHECK (
  ("contract_id" IS NOT NULL AND "due_day" BETWEEN 1 AND 31)
  OR ("contract_id" IS NULL AND "due_day" IN (5, 10, 15, 20, 25))
  OR (
    "contract_id" IS NULL AND "kind" = 'OTHER'
    AND "installment_count" IS NOT NULL AND "installment_count" = 1
    AND "first_due_date" IS NOT NULL
    AND "due_day" = EXTRACT(DAY FROM "first_due_date")
  )
);
