-- AlterTable
ALTER TABLE "PaymentEntry" ADD COLUMN     "external_installments" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "allows_external_installments" BOOLEAN NOT NULL DEFAULT false;
