ALTER TABLE "ContractBook"
  ADD COLUMN "agreed_price_cents" INTEGER CHECK ("agreed_price_cents" > 0);
