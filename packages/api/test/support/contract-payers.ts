import { createHash, randomUUID } from "node:crypto";
import { db } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { ensureAdminUser } from "./finance-test-support.js";

const materialProductIds = new Set<string>();
const MATERIAL_VERSION = createHash("sha256")
  .update(JSON.stringify(["single-receipt-v1", 1, 100, 0]))
  .digest("hex");

export async function contractPayerFixture(
  prefix: string,
): Promise<
  CreateMonthlyContractInput & { newPayer: NonNullable<CreateMonthlyContractInput["newPayer"]> }
> {
  await ensureAdminUser();
  const student = await db.student.create({
    data: { fullName: `${prefix}student`, status: "ACTIVE" },
  });
  const catalogId = randomUUID();
  const product = await db.productLine.create({
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
  materialProductIds.add(product.id);
  const stageId = product.tracks[0]!.stages[0]!.id;
  const settings = {
    tuitionCeilingCents: 25_000,
    maximumDiscountPct: 20,
    punctualityDiscountPct: 20,
    interestRatePctMonthly: 2,
    cancellationFeePct: 10,
    materialPriceCents: 0,
    adultMaterialInstallments: 1,
    adultMaterialInstallmentCents: 100,
    materialCardFeePct: 0,
  };
  await db.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settings },
    update: settings,
  });
  return {
    commandId: randomUUID(),
    studentId: student.id,
    newPayer: {
      name: `${prefix}Maria`,
      documentType: "RG",
      documentNumber: "12.345.678-X",
      phone: "(11) 91234-5678",
      email: "maria@example.com",
    },
    agreedOn: "2026-03-15",
    startsOn: "2026-03-15",
    durationMonths: 12,
    firstDueDate: "2026-03-31",
    monthlyAmountCents: 25_000,
    punctualityDiscountPct: 20,
    material: {
      stageIds: [stageId],
      category: "ADULT",
      payment: "CASH",
      installmentCount: 1,
      quoteVersion: MATERIAL_VERSION,
      expectedTotalCents: 100,
      scholarshipPct: 100,
      scholarshipAgreement: "Cenário de contrato sem cobrança de material",
    },
  };
}

export async function cleanContractMaterials(prefix: string): Promise<void> {
  const contracts = { student: { fullName: { startsWith: prefix } } };
  await db.materialOrderItem.deleteMany({
    where: { materialOrder: { order: { contract: contracts } } },
  });
  await db.materialOrder.deleteMany({ where: { order: { contract: contracts } } });
}

export async function cleanContractPayers(prefix: string): Promise<void> {
  const contracts = { student: { fullName: { startsWith: prefix } } };
  await cleanContractMaterials(prefix);
  await db.installment.deleteMany({ where: { order: { contract: contracts } } });
  await db.order.deleteMany({ where: { contract: contracts } });
  await db.contract.deleteMany({ where: contracts });
  await db.payer.deleteMany({ where: { name: { startsWith: prefix } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: prefix } } });
  await db.guardian.deleteMany({ where: { fullName: { startsWith: prefix } } });
  await db.financeSettings.deleteMany({ where: { id: "singleton" } });
  const productIds = [...materialProductIds];
  await db.stage.deleteMany({ where: { track: { productLineId: { in: productIds } } } });
  await db.track.deleteMany({ where: { productLineId: { in: productIds } } });
  await db.productLine.deleteMany({ where: { id: { in: productIds } } });
  materialProductIds.clear();
  await db.$disconnect();
}
