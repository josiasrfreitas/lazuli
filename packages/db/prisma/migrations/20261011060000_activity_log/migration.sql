CREATE TABLE "ActivityEvent" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_id" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "actor_name" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" UUID,
  "subject_name" TEXT NOT NULL,
  "description" TEXT,
  "deduplication_key" TEXT,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityEvent_deduplication_key_key" ON "ActivityEvent"("deduplication_key");
CREATE INDEX "ActivityEvent_occurred_at_id_idx" ON "ActivityEvent"("occurred_at", "id");
CREATE INDEX "ActivityEvent_area_occurred_at_idx" ON "ActivityEvent"("area", "occurred_at");
CREATE INDEX "ActivityEvent_actor_id_occurred_at_idx" ON "ActivityEvent"("actor_id", "occurred_at");
