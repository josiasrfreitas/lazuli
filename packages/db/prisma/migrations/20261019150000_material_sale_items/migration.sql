-- Preserve every existing sale and receivable; only add its book identity as an item.
CREATE TABLE "MaterialOrderItem" (
  "order_id" UUID NOT NULL,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 2),
  "stage_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "stage_code" TEXT NOT NULL,
  CONSTRAINT "MaterialOrderItem_pkey" PRIMARY KEY ("order_id", "position"),
  CONSTRAINT "MaterialOrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "MaterialOrder"("order_id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "MaterialOrderItem_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "MaterialOrderItem_order_id_stage_id_key" ON "MaterialOrderItem"("order_id", "stage_id");
CREATE INDEX "MaterialOrderItem_stage_id_idx" ON "MaterialOrderItem"("stage_id");
INSERT INTO "MaterialOrderItem" ("order_id", "position", "stage_id", "name", "stage_code")
SELECT "order_id", 1, "stage_id", "name", "stage_code" FROM "MaterialOrder";

ALTER TABLE "Contract" ADD COLUMN "next_material_purchase_on" DATE;
