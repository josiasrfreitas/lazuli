import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ADMIN,
  caller,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  TEST_PREFIX,
} from "./calendar-test-support.js";

const FEDERAL_HOLIDAY_COUNT = 9;
const FEDERAL_HOLIDAY_COUNT_AFTER_CUSTOM_REASON = 8;
const IDEMPOTENT_IMPORT_YEAR = 2031;
const CUSTOM_REASON_IMPORT_YEAR = 2032;
const MANUAL_UPDATE_DATE = "2033-04-21";
const FUTURE_ADD_DATE = "2099-09-07";
const FUTURE_REMOVE_DATE = "2099-11-20";

void describe("calendar API", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanCalendarDatabase();
    await db.$disconnect();
  });

  databaseIt("imports Brazil federal holidays idempotently", importHolidaysIdempotently);

  databaseIt(
    "preserves an existing custom reason during bulk import",
    preserveCustomReasonDuringImport,
  );

  databaseIt("manual add updates the reason for an existing date", updateExistingClosedDayReason);

  databaseIt(
    "manual future add returns stable session side-effect shape",
    addFutureClosedDayWithStableSideEffectShape,
  );

  databaseIt("remove is idempotent and flags future regeneration", removeClosedDayIdempotently);
});

async function importHolidaysIdempotently(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();

  const first = await caller().calendar.importBrazilFederalHolidays({
    year: IDEMPOTENT_IMPORT_YEAR,
  });
  const second = await caller().calendar.importBrazilFederalHolidays({
    year: IDEMPOTENT_IMPORT_YEAR,
  });

  assert.equal(first.imported, FEDERAL_HOLIDAY_COUNT);
  assert.equal(first.skipped, 0);
  assert.equal(second.imported, 0);
  assert.equal(second.skipped, FEDERAL_HOLIDAY_COUNT);
  assert.equal(second.holidays.length, FEDERAL_HOLIDAY_COUNT);
}

async function preserveCustomReasonDuringImport(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  await db.schoolClosedDay.create({
    data: {
      date: new Date(`${CUSTOM_REASON_IMPORT_YEAR}-01-01T00:00:00.000Z`),
      reason: `${TEST_PREFIX}Recesso manual`,
      createdById: ADMIN.id,
    },
  });

  const result = await caller().calendar.importBrazilFederalHolidays({
    year: CUSTOM_REASON_IMPORT_YEAR,
  });
  const janFirst = result.holidays.find(
    (holiday) => holiday.date === `${CUSTOM_REASON_IMPORT_YEAR}-01-01`,
  );

  assert.equal(result.imported, FEDERAL_HOLIDAY_COUNT_AFTER_CUSTOM_REASON);
  assert.equal(result.skipped, 1);
  assert.equal(janFirst?.reason, `${TEST_PREFIX}Recesso manual`);
}

async function updateExistingClosedDayReason(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();

  const created = await caller().calendar.addClosedDay({
    date: MANUAL_UPDATE_DATE,
    reason: `${TEST_PREFIX}Original`,
  });
  const updated = await caller().calendar.addClosedDay({
    date: MANUAL_UPDATE_DATE,
    reason: `${TEST_PREFIX}Atualizado`,
  });

  assert.equal(created.created, true);
  assert.equal(updated.updated, true);
  assert.equal(updated.closedDay.reason, `${TEST_PREFIX}Atualizado`);
}

async function addFutureClosedDayWithStableSideEffectShape(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();

  const result = await caller().calendar.addClosedDay({
    date: FUTURE_ADD_DATE,
    reason: `${TEST_PREFIX}Futuro`,
  });

  assert.equal(result.cancelledSessions, 0);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.regenerateRequired, false);
}

async function removeClosedDayIdempotently(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  await caller().calendar.addClosedDay({
    date: FUTURE_REMOVE_DATE,
    reason: `${TEST_PREFIX}Remover`,
  });

  const first = await caller().calendar.removeClosedDay({ date: FUTURE_REMOVE_DATE });
  const second = await caller().calendar.removeClosedDay({ date: FUTURE_REMOVE_DATE });

  assert.deepEqual(first, { removed: true, regenerateRequired: true });
  assert.deepEqual(second, { removed: false, regenerateRequired: true });
}
