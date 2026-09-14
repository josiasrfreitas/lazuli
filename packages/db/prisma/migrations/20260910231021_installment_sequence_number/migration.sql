ALTER TABLE "Installment" ADD COLUMN "sequence_number" INTEGER;

-- Include deleted rows; ties are resolved by ID for a deterministic backfill.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "order_id" ORDER BY "due_date" ASC, "id" ASC
  ) AS sequence_number
  FROM "Installment"
)
UPDATE "Installment" AS installment
SET "sequence_number" = numbered.sequence_number
FROM numbered
WHERE installment."id" = numbered."id";

ALTER TABLE "Installment" ALTER COLUMN "sequence_number" SET NOT NULL;

CREATE UNIQUE INDEX "Installment_order_id_sequence_number_active_key"
ON "Installment" ("order_id", "sequence_number")
WHERE "deleted_at" IS NULL;
