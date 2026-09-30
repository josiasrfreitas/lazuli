-- Preserve historical beneficiaries while allowing only one active student per order.
-- Existing orders with multiple active beneficiaries must be resolved before deployment.
CREATE UNIQUE INDEX "OrderBeneficiary_one_active_per_order_key"
ON "OrderBeneficiary" ("order_id")
WHERE "deleted_at" IS NULL;
