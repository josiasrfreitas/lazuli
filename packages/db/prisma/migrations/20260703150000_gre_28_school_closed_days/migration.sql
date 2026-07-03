-- CreateTable
CREATE TABLE "SchoolClosedDay" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" UUID,

    CONSTRAINT "SchoolClosedDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClosedDay_date_key" ON "SchoolClosedDay"("date");

-- CreateIndex
CREATE INDEX "SchoolClosedDay_created_by_id_idx" ON "SchoolClosedDay"("created_by_id");

-- AddForeignKey
ALTER TABLE "SchoolClosedDay"
ADD CONSTRAINT "SchoolClosedDay_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
