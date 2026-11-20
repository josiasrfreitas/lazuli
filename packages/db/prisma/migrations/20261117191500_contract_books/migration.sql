CREATE TABLE "ContractBook" (
  "contract_id" UUID NOT NULL REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "semester" INTEGER NOT NULL CHECK ("semester" > 0),
  "stage_id" UUID REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "acquisition_semester" INTEGER CHECK ("acquisition_semester" > 0),
  PRIMARY KEY ("contract_id", "semester")
);
CREATE UNIQUE INDEX "ContractBook_contract_id_stage_id_key" ON "ContractBook" ("contract_id", "stage_id");
