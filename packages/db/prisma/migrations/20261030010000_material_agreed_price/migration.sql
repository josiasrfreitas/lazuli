ALTER TABLE "MaterialOrder" ADD COLUMN "price_override_cents" INTEGER;
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_price_override_positive"
  CHECK ("price_override_cents" IS NULL OR "price_override_cents" > 0);
