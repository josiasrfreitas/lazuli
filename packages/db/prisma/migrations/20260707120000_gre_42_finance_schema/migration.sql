-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('TUITION', 'ENROLLMENT_FEE', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InstallmentAdjustmentType" AS ENUM ('INTEREST', 'LATE_FEE', 'DISCOUNT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'TRANSFER', 'CARD', 'CHEQUE', 'BOLETO', 'OTHER');

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "interest_rate_pct_monthly" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payer" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payer_id" UUID NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "principal_amount_cents" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "due_day" INTEGER NOT NULL,
    "signed_order_artifact_id" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_reason" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderBeneficiary" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "order_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "OrderBeneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "order_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "waived_at" TIMESTAMPTZ,
    "waived_reason" TEXT,
    "overdue_d30_email_sent_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentAdjustment" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "installment_id" UUID NOT NULL,
    "type" "InstallmentAdjustmentType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "InstallmentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEntry" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payer_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "external_reference" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "PaymentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payment_entry_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceSettings_updated_by_id_idx" ON "FinanceSettings"("updated_by_id");

-- CreateIndex
CREATE INDEX "Payer_created_by_id_idx" ON "Payer"("created_by_id");

-- CreateIndex
CREATE INDEX "Payer_updated_by_id_idx" ON "Payer"("updated_by_id");

-- CreateIndex
CREATE INDEX "Order_payer_id_idx" ON "Order"("payer_id");

-- CreateIndex
CREATE INDEX "Order_created_by_id_idx" ON "Order"("created_by_id");

-- CreateIndex
CREATE INDEX "Order_updated_by_id_idx" ON "Order"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderBeneficiary_order_id_student_id_key" ON "OrderBeneficiary"("order_id", "student_id");

-- CreateIndex
CREATE INDEX "OrderBeneficiary_student_id_idx" ON "OrderBeneficiary"("student_id");

-- CreateIndex
CREATE INDEX "OrderBeneficiary_created_by_id_idx" ON "OrderBeneficiary"("created_by_id");

-- CreateIndex
CREATE INDEX "OrderBeneficiary_updated_by_id_idx" ON "OrderBeneficiary"("updated_by_id");

-- CreateIndex
CREATE INDEX "Installment_order_id_idx" ON "Installment"("order_id");

-- CreateIndex
CREATE INDEX "Installment_created_by_id_idx" ON "Installment"("created_by_id");

-- CreateIndex
CREATE INDEX "Installment_updated_by_id_idx" ON "Installment"("updated_by_id");

-- CreateIndex
CREATE INDEX "InstallmentAdjustment_installment_id_idx" ON "InstallmentAdjustment"("installment_id");

-- CreateIndex
CREATE INDEX "InstallmentAdjustment_created_by_id_idx" ON "InstallmentAdjustment"("created_by_id");

-- CreateIndex
CREATE INDEX "InstallmentAdjustment_updated_by_id_idx" ON "InstallmentAdjustment"("updated_by_id");

-- CreateIndex
CREATE INDEX "PaymentEntry_payer_id_idx" ON "PaymentEntry"("payer_id");

-- CreateIndex
CREATE INDEX "PaymentEntry_created_by_id_idx" ON "PaymentEntry"("created_by_id");

-- CreateIndex
CREATE INDEX "PaymentEntry_updated_by_id_idx" ON "PaymentEntry"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_payment_entry_id_installment_id_key" ON "PaymentAllocation"("payment_entry_id", "installment_id");

-- CreateIndex
CREATE INDEX "PaymentAllocation_installment_id_idx" ON "PaymentAllocation"("installment_id");

-- CreateIndex
CREATE INDEX "PaymentAllocation_created_by_id_idx" ON "PaymentAllocation"("created_by_id");

-- CreateIndex
CREATE INDEX "PaymentAllocation_updated_by_id_idx" ON "PaymentAllocation"("updated_by_id");

-- AddCheckConstraint
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_singleton_id_check"
CHECK ("id" = 'singleton');

-- AddCheckConstraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_principal_amount_cents_positive_check"
CHECK ("principal_amount_cents" > 0);

-- AddCheckConstraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_due_day_check"
CHECK ("due_day" IN (5, 10, 15, 20, 25));

-- AddCheckConstraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancellation_reason_check"
CHECK (
  ("cancelled_at" IS NULL AND "cancelled_reason" IS NULL)
  OR ("cancelled_at" IS NOT NULL AND NULLIF(BTRIM(COALESCE("cancelled_reason", '')), '') IS NOT NULL)
);

-- AddCheckConstraint
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_amount_cents_non_negative_check"
CHECK ("amount_cents" >= 0);

-- AddCheckConstraint
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_waiver_reason_check"
CHECK (
  ("waived_at" IS NULL AND "waived_reason" IS NULL)
  OR ("waived_at" IS NOT NULL AND NULLIF(BTRIM(COALESCE("waived_reason", '')), '') IS NOT NULL)
);

-- AddCheckConstraint
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_amount_sign_check"
CHECK (
  ("type" IN ('INTEREST', 'LATE_FEE') AND "amount_cents" > 0)
  OR ("type" = 'DISCOUNT' AND "amount_cents" < 0)
  OR ("type" = 'CORRECTION' AND "amount_cents" <> 0)
);

-- AddCheckConstraint
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_amount_cents_non_negative_check"
CHECK ("amount_cents" >= 0);

-- AddCheckConstraint
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_cents_non_negative_check"
CHECK ("amount_cents" >= 0);

-- AddForeignKey
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBeneficiary" ADD CONSTRAINT "OrderBeneficiary_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBeneficiary" ADD CONSTRAINT "OrderBeneficiary_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBeneficiary" ADD CONSTRAINT "OrderBeneficiary_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBeneficiary" ADD CONSTRAINT "OrderBeneficiary_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "PaymentEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
