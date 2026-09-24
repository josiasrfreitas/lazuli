import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  ADMIN,
  callHttpMutation,
  callHttpQuery,
  ensureAdminUser,
} from "../support/finance-test-support.js";

const SYSTEM_ADMIN = { ...ADMIN, role: "SYSTEM_ADMIN" as const };
const TEACHER = { ...ADMIN, role: "TEACHER" as const };
const settings = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 12_000,
};
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const EXPECTED_FLOOR_CENTS = 20_000;
const EXPECTED_MATERIAL_CENTS = 12_000;
const INVALID_RATE = -1;
const SAVE_SETTINGS_PATH = "finance.saveSettings";

void describe("settings over HTTP", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(async () => {
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    await db.$disconnect();
  });

  void it("rejects ordinary admins, teachers and guests for reads and writes", async () => {
    for (const staffUser of [ADMIN, TEACHER, null]) {
      const expected = staffUser === null ? HTTP_UNAUTHORIZED : HTTP_FORBIDDEN;
      const read = await callHttpQuery({ path: "finance.readSettings", staffUser });
      const write = await callHttpMutation({
        path: SAVE_SETTINGS_PATH,
        body: settings,
        staffUser,
      });
      assert.equal(read.status, expected);
      assert.equal(write.status, expected);
    }
  });

  void it("allows SYSTEM_ADMIN to save and read all values", async () => {
    const write = await callHttpMutation({
      path: SAVE_SETTINGS_PATH,
      body: settings,
      staffUser: SYSTEM_ADMIN,
    });
    assert.equal(write.status, HTTP_OK);
    const read = await callHttpQuery({ path: "finance.readSettings", staffUser: SYSTEM_ADMIN });
    assert.equal(read.status, HTTP_OK);
    const payload = (await read.json()) as {
      result: { data: { json: { tuitionFloorCents: number; materialPriceCents: number } } };
    };
    assert.equal(payload.result.data.json.tuitionFloorCents, EXPECTED_FLOOR_CENTS);
    assert.equal(payload.result.data.json.materialPriceCents, EXPECTED_MATERIAL_CENTS);
  });

  registerInvalidSettingsTest();
});

function registerInvalidSettingsTest(): void {
  void it("rejects an invalid field without changing any saved setting", async () => {
    const baseline = await callHttpMutation({
      path: SAVE_SETTINGS_PATH,
      body: settings,
      staffUser: SYSTEM_ADMIN,
    });
    assert.equal(baseline.status, HTTP_OK);
    const invalid = await callHttpMutation({
      path: SAVE_SETTINGS_PATH,
      body: { ...settings, interestRatePctDaily: INVALID_RATE, materialPriceCents: 1 },
      staffUser: SYSTEM_ADMIN,
    });
    assert.equal(invalid.status, HTTP_BAD_REQUEST);
    const persisted = await db.financeSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    assert.equal(persisted.materialPriceCents, EXPECTED_MATERIAL_CENTS);
  });
}
