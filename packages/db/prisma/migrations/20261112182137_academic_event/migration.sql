-- CreateTable
CREATE TABLE "AcademicEvent" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AcademicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicEvent_starts_at_ends_at_idx" ON "AcademicEvent"("starts_at", "ends_at");

-- Prisma cannot express these domain constraints in the schema.
ALTER TABLE "AcademicEvent"
ADD CONSTRAINT "AcademicEvent_valid_interval_check" CHECK ("ends_at" > "starts_at"),
ADD CONSTRAINT "AcademicEvent_nonempty_title_check" CHECK (length(btrim("title")) > 0);
