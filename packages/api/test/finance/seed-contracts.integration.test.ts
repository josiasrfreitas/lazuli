import assert from "node:assert/strict";
import { it } from "node:test";
import { createDbClient } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { DEV_ADMIN, DEV_SYSTEM_ADMIN, DEV_STUDENTS } from "../../../db/src/seed-dev-data.js";
import { stableUuid } from "../../../db/src/seed-dev-support.js";
import { seedContracts } from "../../../../scripts/seed/contracts.js";
import { seedSettings } from "../../../../scripts/seed/settings.js";

void it("funds every student for a year and derives 95% current contracts at a year boundary", async () => {
  const database = createDbClient();
  const studentIds = DEV_STUDENTS.map((student) => stableUuid(["student", student.key]));
  const payerIds = DEV_STUDENTS.map((student) => stableUuid(["dev-contract-payer", student.key]));
  const today = "2026-01-01";
  try {
    const admin = await database.user.create({ data: { ...DEV_ADMIN, role: "ADMIN" } });
    await database.user.create({ data: { ...DEV_SYSTEM_ADMIN, role: "SYSTEM_ADMIN" } });
    await database.student.createMany({
      data: DEV_STUDENTS.map((student, index) => ({
        id: studentIds[index]!,
        fullName: student.fullName,
      })),
    });
    await seedSettings(database);
    await seedContracts(database, today);
    const contracts = await database.contract.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        payer: true,
        orders: { include: { installments: { include: { allocations: true } } } },
      },
    });
    assert.equal(contracts.length, 160);
    assert.equal(new Set(contracts.map((contract) => contract.studentId)).size, 160);
    for (const contract of contracts) {
      assert.equal(contract.durationMonths, 12);
      assert.equal(
        contract.monthlyAmountCents! >= 20_000 && contract.monthlyAmountCents! <= 25_000,
        true,
      );
      assert.equal(contract.orders.length, 1);
      const installments = contract.orders[0]!.installments;
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
    assert.equal((await service.listContracts({ page: 1, status: "EM_DIA", now })).total, 152);
    assert.equal((await service.listContracts({ page: 1, status: "INADIMPLENTE", now })).total, 8);
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
    await database.order.deleteMany({ where: { contract: { studentId: { in: studentIds } } } });
    await database.contract.deleteMany({ where: { studentId: { in: studentIds } } });
    await database.payer.deleteMany({ where: { id: { in: payerIds } } });
    await database.student.deleteMany({ where: { id: { in: studentIds } } });
    await database.financeSettings.deleteMany();
    await database.user.deleteMany({
      where: { email: { in: [DEV_ADMIN.email, DEV_SYSTEM_ADMIN.email] } },
    });
    await database.$disconnect();
  }
});
