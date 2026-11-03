INSERT INTO "payment_methods" (
  "id", "updated_at", "code", "name", "active", "sort_order", "allows_external_installments"
) VALUES (
  'db03e58f-8040-423e-a06f-737a4c63ae48', CURRENT_TIMESTAMP, 'CREDIT', 'Crédito', true, 4, true
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "active" = true,
  "deleted_at" = NULL,
  "allows_external_installments" = true,
  "updated_at" = CURRENT_TIMESTAMP;
