-- Untyped legacy tax_id values remain unchanged; their document type is unknown.
ALTER TABLE "Payer"
  ADD COLUMN "document_type" "DocumentType",
  ADD COLUMN "document_number" TEXT,
  ADD CONSTRAINT "Payer_document_number_requires_type"
    CHECK ("document_number" IS NULL OR "document_type" IS NOT NULL);
