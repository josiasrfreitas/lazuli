CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'FOLLOWING_UP', 'CLOSED');

ALTER TABLE "PedagogicalOccurrence"
  ADD COLUMN "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "status_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "OccurrenceStatusChange" (
  "id" UUID NOT NULL,
  "occurrence_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "from_status" "OccurrenceStatus" NOT NULL,
  "to_status" "OccurrenceStatus" NOT NULL,
  "conclusion" TEXT,
  CONSTRAINT "OccurrenceStatusChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OccurrenceStatusChange_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "PedagogicalOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OccurrenceStatusChange_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OccurrenceStatusChange_transition" CHECK (
    ("from_status" = 'OPEN' AND "to_status" IN ('FOLLOWING_UP', 'CLOSED'))
    OR ("from_status" = 'FOLLOWING_UP' AND "to_status" = 'CLOSED')
    OR ("from_status" = 'CLOSED' AND "to_status" = 'FOLLOWING_UP')
  ),
  CONSTRAINT "OccurrenceStatusChange_conclusion" CHECK (
    "to_status" <> 'CLOSED' OR ("conclusion" IS NOT NULL AND length(btrim("conclusion")) >= 3)
  )
);
CREATE INDEX "OccurrenceStatusChange_occurrence_id_created_at_idx" ON "OccurrenceStatusChange"("occurrence_id", "created_at");
CREATE INDEX "PedagogicalOccurrence_status_created_at_idx" ON "PedagogicalOccurrence"("status", "created_at");
