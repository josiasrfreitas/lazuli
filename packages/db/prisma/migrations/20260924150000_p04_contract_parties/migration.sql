ALTER TYPE "OrderKind" ADD VALUE 'CONTRACT';

CREATE TABLE "Contract" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "payer_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Contract_payer_id_idx" ON "Contract"("payer_id");
CREATE INDEX "Contract_student_id_idx" ON "Contract"("student_id");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "contract_id" UUID;
ALTER TABLE "Order" ALTER COLUMN "payer_id" DROP NOT NULL;
CREATE INDEX "Order_contract_id_idx" ON "Order"("contract_id");
ALTER TABLE "Order" ADD CONSTRAINT "Order_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_party_source_check" CHECK (
  ("kind" = 'CONTRACT' AND "contract_id" IS NOT NULL AND "payer_id" IS NULL)
  OR ("kind" <> 'CONTRACT' AND "contract_id" IS NULL AND "payer_id" IS NOT NULL)
);

CREATE FUNCTION reject_contract_order_beneficiary() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Order" WHERE "id" = NEW."order_id" AND "kind" = 'CONTRACT') THEN
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
  IF NEW."kind" = 'CONTRACT' AND EXISTS (
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

CREATE FUNCTION preserve_contract_order_parties() RETURNS trigger AS $$
BEGIN
  IF (NEW."payer_id", NEW."student_id") IS DISTINCT FROM (OLD."payer_id", OLD."student_id")
     AND EXISTS (SELECT 1 FROM "Order" WHERE "contract_id" = OLD."id") THEN
    RAISE EXCEPTION 'Contract parties with orders cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Contract_order_parties_guard"
  BEFORE UPDATE OF "payer_id", "student_id" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION preserve_contract_order_parties();
