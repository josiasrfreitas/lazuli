-- AlterTable
ALTER TABLE "AttendanceProjection" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AttendanceSettings" DROP CONSTRAINT "AttendanceSettings_pkey",
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "key" TEXT NOT NULL DEFAULT 'school',
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSettings_key_key" ON "AttendanceSettings"("key");

-- Recreate the campus bounds after Prisma replaces the former singleton identifier.
ALTER TABLE "AttendanceSettings" ADD CONSTRAINT "AttendanceSettings_bounds_check" CHECK (
  "key" = 'school' AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
  AND "radius_meters" BETWEEN 10 AND 1000 AND "max_accuracy_meters" BETWEEN 5 AND 500
);
