CREATE TABLE "payment_proofs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_entry_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_proofs_byte_length_check" CHECK ("byte_length" > 0 AND "byte_length" <= 5242880),
    CONSTRAINT "payment_proofs_content_type_check" CHECK ("content_type" IN ('application/pdf', 'image/jpeg', 'image/png')),
    CONSTRAINT "payment_proofs_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "PaymentEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_proofs_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_proofs_bucket_key_key" ON "payment_proofs"("bucket", "key");
CREATE INDEX "payment_proofs_payment_entry_id_idx" ON "payment_proofs"("payment_entry_id");
CREATE INDEX "payment_proofs_uploaded_by_id_idx" ON "payment_proofs"("uploaded_by_id");
