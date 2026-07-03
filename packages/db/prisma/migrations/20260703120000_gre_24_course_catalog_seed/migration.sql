-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'LEGACY');

-- CreateTable
CREATE TABLE "ProductLine" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "portal_prefix" TEXT,

    CONSTRAINT "ProductLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "product_line_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "portal_prefix" TEXT,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "track_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductLine_key_key" ON "ProductLine"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLine_name_key" ON "ProductLine"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Track_product_line_id_name_key" ON "Track"("product_line_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_track_id_internal_code_key" ON "Stage"("track_id", "internal_code");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_track_id_sequence_key" ON "Stage"("track_id", "sequence");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_product_line_id_fkey" FOREIGN KEY ("product_line_id") REFERENCES "ProductLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
