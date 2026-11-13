import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import {
  ADMIN,
  caller,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  TEST_PREFIX,
} from "../support/calendar-test-support.js";
import type { CalendarChange } from "../../src/calendar/change-schema.js";

void before(async () => {
  await db.$connect();
});
void after(async () => {
  await cleanCalendarDatabase();
  await db.$disconnect();
});
async function confirm(change: CalendarChange) {
  const preview = await caller().calendar.academic.changes.preview(change);
  return caller().calendar.academic.changes.confirm({
    change,
    fingerprint: preview.fingerprint,
    commandId: randomUUID(),
  });
}
void it("requires a fresh preview and deduplicates the same confirmed command", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const change: CalendarChange = {
    action: "interruption",
    kind: "RECESS",
    title: `${TEST_PREFIX}Original`,
    description: null,
    from: "2033-04-21",
    through: "2033-04-21",
  };
  const preview = await caller().calendar.academic.changes.preview(change);
  const commandId = randomUUID();
  const first = await caller().calendar.academic.changes.confirm({
    change,
    fingerprint: preview.fingerprint,
    commandId,
  });
  const retry = await caller().calendar.academic.changes.confirm({
    change,
    fingerprint: preview.fingerprint,
    commandId,
  });
  assert.equal(first.id, retry.id);
  assert.equal(first.status, "PENDING");
  await assert.rejects(
    caller().calendar.academic.changes.confirm({
      change,
      fingerprint: preview.fingerprint,
      commandId: randomUUID(),
    }),
    /agenda mudou/u,
  );
  assert.equal(await db.academicInterruption.count({ where: { title: change.title } }), 1);
});
void it("removing one interruption preserves another interruption and an unmanaged closure", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const change: CalendarChange = {
    action: "interruption",
    kind: "RECESS",
    title: `${TEST_PREFIX}Intervalo`,
    description: null,
    from: "2099-11-20",
    through: "2099-11-22",
  };
  await db.schoolClosedDay.create({
    data: { date: new Date("2099-11-20"), reason: `${TEST_PREFIX}Manual`, createdById: ADMIN.id },
  });
  await confirm(change);
  await confirm({
    ...change,
    title: `${TEST_PREFIX}Sobreposto`,
    from: "2099-11-21",
    through: "2099-11-21",
  });
  const original = await db.academicInterruption.findFirstOrThrow({
    where: { title: change.title },
  });
  await confirm({
    action: "removeInterruption",
    id: original.id,
    expectedUpdatedAt: original.updatedAt.toISOString(),
  });
  const rows = await db.schoolClosedDay.findMany({
    where: { date: { gte: new Date("2099-11-20"), lte: new Date("2099-11-22") }, deletedAt: null },
    orderBy: { date: "asc" },
  });
  assert.deepEqual(
    rows.map((row) => row.date.toISOString().slice(0, 10)),
    ["2099-11-20", "2099-11-21"],
  );
  assert.equal(rows[0]?.calendarManaged, false);
  assert.equal(rows[0]?.reason, `${TEST_PREFIX}Manual`);
});
void it("holiday import preserves custom reasons and is idempotent", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  await db.schoolClosedDay.create({
    data: {
      date: new Date("2032-01-01"),
      reason: `${TEST_PREFIX}Recesso manual`,
      createdById: ADMIN.id,
    },
  });
  const change: CalendarChange = {
    action: "holidays",
    dates: [{ date: "2032-01-01", title: "Ano novo", sourceKey: "BR:2032-01-01" }],
  };
  await confirm(change);
  await confirm(change);
  assert.equal(await db.academicInterruption.count({ where: { sourceKey: "BR:2032-01-01" } }), 1);
  assert.equal(
    (await db.schoolClosedDay.findUniqueOrThrow({ where: { date: new Date("2032-01-01") } }))
      .reason,
    `${TEST_PREFIX}Recesso manual`,
  );
});
void it("semester confirmation persists a worker request and rejects overlapping periods", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const change: CalendarChange = {
    action: "period",
    name: `${TEST_PREFIX}2098.1`,
    from: "2098-02-01",
    through: "2098-06-30",
  };
  const saved = await confirm(change);
  assert.ok(saved.semesterId);
  assert.equal(saved.status, "PENDING");
  await assert.rejects(
    caller().calendar.academic.changes.preview({ ...change, name: `${TEST_PREFIX}Sobreposição` }),
    /coincide/u,
  );
});
