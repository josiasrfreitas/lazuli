import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const values = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 12_000,
};
const EXPECTED_FLOOR_CENTS = 20_000;
const EXPECTED_MATERIAL_CENTS = 12_000;

void describe("global finance settings persistence", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(async () => {
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    await db.$disconnect();
  });

  void it("reads empty and incomplete settings without invented values", async () => {
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    assert.equal(await finance(db, ADMIN.id).readSettings(), null);
    await db.financeSettings.create({ data: { id: "singleton", interestRatePctMonthly: 1 } });
    const row = await finance(db, ADMIN.id).readSettings();
    assert.equal(row?.tuitionCeilingCents, null);
    assert.equal(row?.tuitionFloorCents, null);
    assert.equal(row?.interestRatePctMonthly, 1);
  });

  void it("persists independent book bands and preserves them on older general settings saves", async () => {
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    assert.equal(await finance(db, ADMIN.id).readMaterialPrice(), null);
    await finance(db, ADMIN.id).saveSettings({
      ...values,
      childMaterialInstallments: 6,
      childMaterialInstallmentCents: 12300,
      adultMaterialInstallments: 4,
      adultMaterialInstallmentCents: 13600,
      materialCardFeePct: 5,
    });
    await finance(db, ADMIN.id).saveSettings({ ...values, maximumDiscountPct: 25 });
    assert.deepEqual(await finance(db, ADMIN.id).readMaterialPrice(), {
      child: {
        installments: 6,
        installmentCents: 12300,
        totalCents: 73800,
        cashCents: 70110,
        version: "3e63f864a0c14927bc438ba37f0e40c8670d212e63f5a7d675922de4247575e8",
      },
      adult: {
        installments: 4,
        installmentCents: 13600,
        totalCents: 54400,
        cashCents: 51680,
        version: "97c265ea424e421f33d028cf4dc0f89f0d5bd3ce4a140f1a792207d9afe3a1c4",
      },
      cardFeePct: 5,
    });
    await finance(db, ADMIN.id).saveSettings({
      ...values,
      childMaterialInstallments: 6,
      childMaterialInstallmentCents: 0,
    });
    assert.deepEqual((await finance(db, ADMIN.id).readMaterialPrice())?.child, {
      installments: 6,
      installmentCents: 0,
      totalCents: 0,
      cashCents: 0,
      version: "4c8e28f863a17fc2bcca94c065b934e2326ff9befc1e8497f4da82dc42225a61",
    });
  });

  void it("saves all fields with the actor and a derived floor", async () => {
    const beforeSave = new Date();
    const row = await db.$transaction((tx) => finance(tx, ADMIN.id).saveSettings(values));
    assert.equal(row?.tuitionFloorCents, EXPECTED_FLOOR_CENTS);
    assert.equal(row?.materialPriceCents, EXPECTED_MATERIAL_CENTS);
    assert.equal(row?.updatedByName, "GRE-43 Finance Admin");
    assert.equal((row?.updatedAt.getTime() ?? 0) >= beforeSave.getTime(), true);
    const persisted = await db.financeSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    assert.equal(persisted.updatedById, ADMIN.id);
  });
});
