-- CreateEnum
CREATE TYPE "PaymentReversalKind" AS ENUM ('CANCELLATION', 'REFUND');

-- CreateTable
CREATE TABLE "payment_reversals" (
    "id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "command_fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payment_entry_id" UUID NOT NULL,
    "kind" "PaymentReversalKind" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refund_method" TEXT,
    "refund_reference" TEXT,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reversal_allocations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payment_reversal_id" UUID NOT NULL,
    "payment_allocation_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "payment_reversal_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reversal_proofs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "payment_reversal_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "payment_reversal_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversals_command_id_key" ON "payment_reversals"("command_id");

-- CreateIndex
CREATE INDEX "payment_reversals_payment_entry_id_idx" ON "payment_reversals"("payment_entry_id");

-- CreateIndex
CREATE INDEX "payment_reversals_created_by_id_idx" ON "payment_reversals"("created_by_id");

-- CreateIndex
CREATE INDEX "payment_reversal_allocations_payment_allocation_id_idx" ON "payment_reversal_allocations"("payment_allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversal_allocations_payment_reversal_id_payment_al_key" ON "payment_reversal_allocations"("payment_reversal_id", "payment_allocation_id");

-- CreateIndex
CREATE INDEX "payment_reversal_proofs_payment_reversal_id_idx" ON "payment_reversal_proofs"("payment_reversal_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversal_proofs_bucket_key_key" ON "payment_reversal_proofs"("bucket", "key");

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "PaymentEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_refund_method_fkey" FOREIGN KEY ("refund_method") REFERENCES "payment_methods"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_reversal_allocations" ADD CONSTRAINT "payment_reversal_allocations_payment_reversal_id_fkey" FOREIGN KEY ("payment_reversal_id") REFERENCES "payment_reversals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversal_allocations" ADD CONSTRAINT "payment_reversal_allocations_payment_allocation_id_fkey" FOREIGN KEY ("payment_allocation_id") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversal_proofs" ADD CONSTRAINT "payment_reversal_proofs_payment_reversal_id_fkey" FOREIGN KEY ("payment_reversal_id") REFERENCES "payment_reversals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversal_proofs" ADD CONSTRAINT "payment_reversal_proofs_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
