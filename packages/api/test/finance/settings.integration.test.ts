import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const values = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
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

  void it("reads missing settings and applies the monthly interest default to incomplete settings", async () => {
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    assert.equal(await finance(db, ADMIN.id).readSettings(), null);
    await db.financeSettings.create({ data: { id: "singleton" } });
    const row = await finance(db, ADMIN.id).readSettings();
    assert.equal(row?.tuitionCeilingCents, null);
    assert.equal(row?.tuitionFloorCents, null);
    assert.equal(row?.interestRatePctMonthly, 2);
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
    const price = await finance(db, ADMIN.id).readMaterialPrice();
    assert.equal(price?.child.cashCents, 70110);
    assert.equal(price?.adult.cashCents, 51680);
    assert.equal(price?.cardFeeRates["6"], 5);
    await finance(db, ADMIN.id).saveSettings({
      ...values,
      childMaterialInstallments: 6,
      childMaterialInstallmentCents: 0,
    });
    const savedPrice = await finance(db, ADMIN.id).readMaterialPrice();
    assert.equal(savedPrice?.child.cashCents, 0);
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

  void it("persists final cash prices and a separate card rate for each installment count", async () => {
    await finance(db, ADMIN.id).saveSettings({
      ...values,
      childMaterialCashPriceCents: 60_000,
      adultMaterialCashPriceCents: 70_000,
      materialCardFeeRates: { "1": 0, "2": 3.5, "6": 10 },
    });
    const price = await finance(db, ADMIN.id).readMaterialPrice();
    assert.equal(price?.child.cashCents, 60_000);
    assert.equal(price?.adult.cashCents, 70_000);
    assert.deepEqual(price?.cardFeeRates, { "1": 0, "2": 3.5, "6": 10 });
  });
});
