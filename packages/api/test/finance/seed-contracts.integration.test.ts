import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { createDbClient } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import {
  DEV_ADMIN,
  DEV_CLASSES,
  DEV_SYSTEM_ADMIN,
  DEV_STUDENTS,
} from "../../../db/src/seed-dev-data.js";
import { stableUuid } from "../../../db/src/seed-dev-support.js";
import { seedContracts } from "../../../../scripts/seed/contracts.js";
import { seedSettings } from "../../../../scripts/seed/settings.js";

void it("funds allocated students for a year with shared payers, partial payments and settled late payments", async () => {
  const database = createDbClient();
  const studentIds = DEV_STUDENTS.map((student) => stableUuid(["student", student.key]));
  const payerIds = [
    ...new Set(
      DEV_STUDENTS.map((student) =>
        stableUuid(["dev-contract-payer", student.guardian?.key ?? student.key]),
      ),
    ),
  ];
  const today = "2026-01-01";
  let materialProductId: string | undefined;
  try {
    const admin = await database.user.create({ data: { ...DEV_ADMIN, role: "ADMIN" } });
    await database.user.create({ data: { ...DEV_SYSTEM_ADMIN, role: "SYSTEM_ADMIN" } });
    await database.student.createMany({
      data: DEV_STUDENTS.map((student, index) => ({
        id: studentIds[index]!,
        fullName: student.fullName,
      })),
    });
    const catalogId = randomUUID();
    const codes = [...new Set(DEV_CLASSES.map((classSeed) => classSeed.stageInternalCode))];
    const materialProduct = await database.productLine.create({
      data: {
        key: `seed_contract_test_${catalogId}`,
        name: `Seed contract test ${catalogId}`,
        tracks: {
          create: {
            name: "Adultos / English Main",
            stages: {
              create: codes.map((code, index) => ({
                name: `Test book ${code}`,
                internalCode: code,
                sequence: index + 1,
              })),
            },
          },
        },
      },
    });
    materialProductId = materialProduct.id;
    await seedSettings(database);
    await seedContracts(database, today);
    const contracts = await database.contract.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        payer: true,
        orders: { include: { installments: { include: { allocations: true } } } },
      },
    });
    assert.equal(contracts.length, 220);
    assert.equal(new Set(contracts.map((contract) => contract.studentId)).size, 220);
    assert.equal(new Set(contracts.map((contract) => contract.payerId)).size, 205);
    for (const contract of contracts) {
      assert.equal(contract.durationMonths, 12);
      assert.equal(
        contract.monthlyAmountCents! >= 20_000 && contract.monthlyAmountCents! <= 25_000,
        true,
      );
      assert.equal(contract.orders.length, 2);
      const installments = contract.orders.find((order) => order.kind === "TUITION")!.installments;
      assert.equal(installments.length, 12);
      assert.equal(installments.filter((item) => item.dueDate > new Date(today)).length >= 3, true);
      assert.equal(
        installments
          .filter((item) => item.dueDate > new Date(today))
          .flatMap((item) => item.allocations).length,
        0,
      );
    }
    const service = finance(database, admin.id);
    const now = new Date(`${today}T12:00:00Z`);
    const currentContracts = await service.listContracts({ page: 1, status: "EM_DIA", now });
    const overdueContracts = await service.listContracts({ page: 1, status: "INADIMPLENTE", now });
    assert.equal(currentContracts.total, 198);
    assert.equal(overdueContracts.total, 22);
    const partial = contracts.find((contract) => contract.studentId === studentIds[1])!;
    const lastDue = partial.orders
      .find((order) => order.kind === "TUITION")!
      .installments.filter((item) => item.dueDate < new Date(today))
      .toSorted((left, right) => right.sequenceNumber - left.sequenceNumber)[0]!;
    assert.equal(
      lastDue.allocations.reduce((sum, row) => sum + row.amountCents, 0),
      lastDue.amountCents / 2,
    );
    const lateSettled = contracts.find((contract) => contract.studentId === studentIds[2])!;
    const interest = await database.installmentAdjustment.findMany({
      where: { type: "INTEREST", installment: { order: { contractId: lateSettled.id } } },
    });
    assert.equal(interest.length > 0, true);
    assert.equal(
      interest.every((row) => row.amountCents > 0),
      true,
    );
    const first = contracts.find((contract) => contract.studentId === studentIds[0])!;
    assert.equal(first.payer.name, "Patrícia Rocha Andrade");
    const payments = await database.paymentEntry.findMany({ where: { payerId: { in: payerIds } } });
    assert.equal(
      payments.every((payment) => payment.date < now),
      true,
    );
  } finally {
    const installment = { order: { contract: { studentId: { in: studentIds } } } };
    await database.paymentAllocation.deleteMany({ where: { installment } });
    await database.installmentAdjustment.deleteMany({ where: { installment } });
    await database.paymentEntry.deleteMany({ where: { payerId: { in: payerIds } } });
    await database.installment.deleteMany({ where: installment });
    await database.materialOrderItem.deleteMany({
      where: { materialOrder: { order: { contract: { studentId: { in: studentIds } } } } },
    });
    await database.materialOrder.deleteMany({
      where: { order: { contract: { studentId: { in: studentIds } } } },
    });
    await database.order.deleteMany({ where: { contract: { studentId: { in: studentIds } } } });
    await database.contract.deleteMany({ where: { studentId: { in: studentIds } } });
    await database.payer.deleteMany({ where: { id: { in: payerIds } } });
    await database.student.deleteMany({ where: { id: { in: studentIds } } });
    await database.financeSettings.deleteMany();
    if (materialProductId) {
      await database.stage.deleteMany({ where: { track: { productLineId: materialProductId } } });
      await database.track.deleteMany({ where: { productLineId: materialProductId } });
      await database.productLine.delete({ where: { id: materialProductId } });
    }
    await database.user.deleteMany({
      where: { email: { in: [DEV_ADMIN.email, DEV_SYSTEM_ADMIN.email] } },
    });
    await database.$disconnect();
  }
});
