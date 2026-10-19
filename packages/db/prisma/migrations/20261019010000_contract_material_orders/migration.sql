CREATE TYPE "MaterialPriceCategory" AS ENUM ('CHILD', 'ADULT');
CREATE TYPE "MaterialPayment" AS ENUM ('INSTALLMENTS', 'CASH');
CREATE TABLE "MaterialOrder" (
  "order_id" UUID PRIMARY KEY REFERENCES "Order"("id") ON DELETE RESTRICT,
  "stage_id" UUID NOT NULL REFERENCES "Stage"("id") ON DELETE RESTRICT,
  "command_id" UUID UNIQUE,
  "command_fingerprint" TEXT,
  "name" TEXT NOT NULL,
  "stage_code" TEXT NOT NULL,
  "category" "MaterialPriceCategory" NOT NULL,
  "payment" "MaterialPayment" NOT NULL,
  "list_price_cents" INTEGER NOT NULL CHECK ("list_price_cents" >= 0),
  "cash_discount_pct" DECIMAL(7,4) NOT NULL CHECK ("cash_discount_pct" BETWEEN 0 AND 100),
  "quoted_installments" INTEGER NOT NULL CHECK ("quoted_installments" > 0),
  "quoted_installment_cents" INTEGER NOT NULL CHECK ("quoted_installment_cents" >= 0),
  CONSTRAINT "material_list_price_matches_quote" CHECK (
    "list_price_cents"::bigint = "quoted_installments"::bigint * "quoted_installment_cents"::bigint
  )
);
CREATE INDEX "MaterialOrder_stage_id_idx" ON "MaterialOrder"("stage_id");
