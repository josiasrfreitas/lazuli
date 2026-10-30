import { createHash, randomUUID } from "node:crypto";
import type { TransactionClient } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";

export const TEST_MATERIAL_SETTINGS = {
  adultMaterialInstallments: 1,
  adultMaterialInstallmentCents: 100,
  materialCardFeePct: 0,
} as const;

const QUOTE_VERSION = createHash("sha256")
  .update(JSON.stringify(["single-receipt-v1", 1, 100, 0]))
  .digest("hex");

export async function contractMaterialFixture(
  database: TransactionClient,
  prefix: string,
): Promise<NonNullable<CreateMonthlyContractInput["material"]>> {
  const catalogId = randomUUID();
  const product = await database.productLine.create({
    data: {
      key: `contract_test_${catalogId}`,
      name: `${prefix}material catalog ${catalogId}`,
      tracks: {
        create: {
          name: "Adultos / English Main",
          stages: { create: { name: "Test book", internalCode: "T1", sequence: 1 } },
        },
      },
    },
    include: { tracks: { include: { stages: true } } },
  });
  return {
    stageIds: [product.tracks[0]!.stages[0]!.id],
    category: "ADULT",
    payment: "CASH",
    installmentCount: 1,
    quoteVersion: QUOTE_VERSION,
    expectedTotalCents: 100,
    scholarshipPct: 100,
    scholarshipAgreement: "Cenário de contrato sem cobrança de material",
  };
}

export async function cleanContractMaterialFixture(
  database: TransactionClient,
  { prefix, contractIds }: { prefix: string; contractIds: string[] },
): Promise<void> {
  const order = { contractId: { in: contractIds } };
  await database.materialOrderItem.deleteMany({ where: { materialOrder: { order } } });
  await database.materialOrder.deleteMany({ where: { order } });
  const products = await database.productLine.findMany({
    where: { name: { startsWith: `${prefix}material catalog ` } },
    select: { id: true },
  });
  const productIds = products.map(({ id }) => id);
  await database.stage.deleteMany({ where: { track: { productLineId: { in: productIds } } } });
  await database.track.deleteMany({ where: { productLineId: { in: productIds } } });
  await database.productLine.deleteMany({ where: { id: { in: productIds } } });
}
