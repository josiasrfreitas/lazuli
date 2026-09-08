import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import { db } from "@lazuli/db";

import {
  ADMIN,
  caller,
  callerWithQueue,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  TEST_PREFIX,
} from "../support/calendar-test-support.js";
import { recordingSessionsGenerateQueue } from "../support/session-generation-queue-support.js";

const FEDERAL_HOLIDAY_COUNT = 9;
const FEDERAL_HOLIDAY_COUNT_AFTER_CUSTOM_REASON = 8;
const IDEMPOTENT_IMPORT_YEAR = 2031;
const CUSTOM_REASON_IMPORT_YEAR = 2032;
const MANUAL_UPDATE_DATE = "2033-04-21";
const FUTURE_REMOVE_DATE = "2099-11-20";
const SEMESTER_NAME = `${TEST_PREFIX}2098.1`;

void before(async () => {
  await db.$connect();
});

void after(async () => {
  await cleanCalendarDatabase();
  await db.$disconnect();
});

void it("imports Brazil federal holidays idempotently", async () => {
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
});

void it("preserves an existing custom reason during bulk import", async () => {
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
});

void it("manual add updates the reason for an existing date", async () => {
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
});

void it("remove is idempotent and flags future regeneration", async () => {
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
});

void it("create semester enqueues session generation", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const queue = recordingSessionsGenerateQueue("job-calendar");

  const result = await callerWithQueue({ queue }).calendar.createSemester({
    name: SEMESTER_NAME,
    startDate: "2098-02-01",
    endDate: "2098-06-30",
  });

  assert.equal(result.semester.name, SEMESTER_NAME);
  assert.equal(result.sessionsGenerateJob.workflowName, "sessions-generate");
  assert.deepEqual(queue.calls, [{ semesterId: result.semester.id }]);
});
