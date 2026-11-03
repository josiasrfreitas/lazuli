-- An enrollment fee is a charge created by the contract, like tuition and material.
ALTER TABLE "Order" DROP CONSTRAINT "Order_party_source_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_party_source_check" CHECK (
  (contract_id IS NOT NULL AND payer_id IS NULL AND kind IN ('TUITION', 'MATERIAL', 'ENROLLMENT_FEE'))
  OR (contract_id IS NULL AND payer_id IS NOT NULL)
);
