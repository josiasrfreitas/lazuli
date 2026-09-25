import { randomUUID } from "node:crypto";
import { db } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { ensureAdminUser } from "./finance-test-support.js";

export async function contractPayerFixture(
  prefix: string,
): Promise<
  CreateMonthlyContractInput & { newPayer: NonNullable<CreateMonthlyContractInput["newPayer"]> }
> {
  await ensureAdminUser();
  const student = await db.student.create({
    data: { fullName: `${prefix}student`, status: "ACTIVE" },
  });
  const settings = {
    tuitionCeilingCents: 25_000,
    maximumDiscountPct: 20,
    punctualityDiscountPct: 20,
    interestRatePctDaily: 0.1,
    interestRatePctMonthly: 2,
    cancellationFeePct: 10,
    materialPriceCents: 0,
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
  };
}

export async function cleanContractPayers(prefix: string): Promise<void> {
  const contracts = { student: { fullName: { startsWith: prefix } } };
  await db.installment.deleteMany({ where: { order: { contract: contracts } } });
  await db.order.deleteMany({ where: { contract: contracts } });
  await db.contract.deleteMany({ where: contracts });
  await db.payer.deleteMany({ where: { name: { startsWith: prefix } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: prefix } } });
  await db.guardian.deleteMany({ where: { fullName: { startsWith: prefix } } });
  await db.financeSettings.deleteMany({ where: { id: "singleton" } });
  await db.$disconnect();
}
