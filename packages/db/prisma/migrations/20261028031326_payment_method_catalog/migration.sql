BEGIN;

-- AlterTable
ALTER TABLE "PaymentEntry" ALTER COLUMN "method" TYPE TEXT USING "method"::text;

-- DropEnum
DROP TYPE "PaymentMethod";

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- Preserve historical codes; only the four current methods accept new payments.
INSERT INTO "payment_methods" ("id", "updated_at", "code", "name", "active", "sort_order") VALUES
('e5c9629c-fa88-4f67-9191-b508c7eab4c5', CURRENT_TIMESTAMP, 'PIX', 'Pix', true, 0),
('50258a60-246f-48cb-aeb0-b64fd4054b9f', CURRENT_TIMESTAMP, 'CASH', 'Dinheiro', true, 1),
('081da2be-66fd-4c6c-a363-201219ac7cfd', CURRENT_TIMESTAMP, 'DEBIT', 'Débito', true, 2),
('04e6cf5e-924a-4c9c-8010-c4ac0bc5a36b', CURRENT_TIMESTAMP, 'RECURRING_CREDIT', 'Crédito recorrente', true, 3),
('7cecc7a4-e21a-4e24-a43c-b1dad2160fb9', CURRENT_TIMESTAMP, 'TRANSFER', 'Transferência', false, 4),
('12b8f24c-2ac9-447b-a0e6-f15e2612f1d8', CURRENT_TIMESTAMP, 'CARD', 'Cartão', false, 5),
('370756f6-b523-444d-939c-5dbb40a83a87', CURRENT_TIMESTAMP, 'CHEQUE', 'Cheque', false, 6),
('9eb3c7d5-b48a-4ecd-bb77-ee22c257a7fa', CURRENT_TIMESTAMP, 'BOLETO', 'Boleto', false, 7),
('02b9d9c1-a0e5-4db4-9a89-b35a30c2afaa', CURRENT_TIMESTAMP, 'OTHER', 'Outro', false, 8);

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_method_fkey" FOREIGN KEY ("method") REFERENCES "payment_methods"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
