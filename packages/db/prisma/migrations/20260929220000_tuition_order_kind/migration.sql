-- The kind names what is owed; contract_id identifies the agreement that originated it.
ALTER TABLE "Order" DROP CONSTRAINT "Order_party_source_check";
ALTER TABLE "Order" DROP CONSTRAINT "Order_due_day_check";
DROP TRIGGER "OrderBeneficiary_contract_source_guard" ON "OrderBeneficiary";
DROP TRIGGER "Order_contract_source_guard" ON "Order";
DROP FUNCTION reject_contract_order_beneficiary();
DROP FUNCTION reject_contract_order_with_beneficiaries();

UPDATE "Order" SET "kind" = 'TUITION' WHERE "kind" = 'CONTRACT';

CREATE TYPE "OrderKind_new" AS ENUM ('TUITION', 'ENROLLMENT_FEE', 'MATERIAL', 'OTHER');
ALTER TABLE "Order" ALTER COLUMN "kind" TYPE "OrderKind_new"
  USING ("kind"::text::"OrderKind_new");
DROP TYPE "OrderKind";
ALTER TYPE "OrderKind_new" RENAME TO "OrderKind";

ALTER TABLE "Order" ADD CONSTRAINT "Order_party_source_check" CHECK (
  ("contract_id" IS NOT NULL AND "payer_id" IS NULL AND "kind" = 'TUITION')
  OR ("contract_id" IS NULL AND "payer_id" IS NOT NULL)
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_due_day_check" CHECK (
  ("contract_id" IS NOT NULL AND "due_day" BETWEEN 1 AND 31)
  OR ("contract_id" IS NULL AND "due_day" IN (5, 10, 15, 20, 25))
);

CREATE FUNCTION reject_contract_order_beneficiary() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Order" WHERE "id" = NEW."order_id" AND "contract_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Contract orders cannot have direct beneficiaries';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderBeneficiary_contract_source_guard"
  BEFORE INSERT OR UPDATE OF "order_id" ON "OrderBeneficiary"
  FOR EACH ROW EXECUTE FUNCTION reject_contract_order_beneficiary();

CREATE FUNCTION reject_contract_order_with_beneficiaries() RETURNS trigger AS $$
BEGIN
  IF NEW."contract_id" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "OrderBeneficiary" WHERE "order_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Contract orders cannot have direct beneficiaries';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Order_contract_source_guard"
  BEFORE UPDATE OF "kind", "contract_id" ON "Order"
  FOR EACH ROW EXECUTE FUNCTION reject_contract_order_with_beneficiaries();
