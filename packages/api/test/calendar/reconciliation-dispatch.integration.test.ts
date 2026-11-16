import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  ADMIN,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  TEST_PREFIX,
} from "../support/calendar-test-support.js";

void before(async () => {
  await db.$connect();
  await ensureCalendarUsers();
});
void after(async () => {
  await cleanCalendarDatabase();
  await db.$disconnect();
});

void it("dispatches the committed request and preserves it when Hatchet is unavailable", async () => {
  await cleanCalendarDatabase();
  const dispatched: string[] = [];
  const caller = createCaller({
    db,
    staffUser: ADMIN,
    calendarReconciliationQueue: {
      enqueue: async (id) => {
        const persisted = await db.calendarReconciliationRequest.findUniqueOrThrow({
          where: { id },
        });
        assert.equal(persisted.status, "PENDING");
        dispatched.push(id);
        throw new Error("QUEUE_UNAVAILABLE");
      },
    },
  });
  const change = {
    action: "interruption" as const,
    kind: "RECESS" as const,
    title: `${TEST_PREFIX}Dispatch`,
    description: null,
    from: "2033-09-01",
    through: "2033-09-02",
  };
  const preview = await caller.calendar.academic.changes.preview(change);
  const commandId = randomUUID();
  const result = await caller.calendar.academic.changes.confirm({
    change,
    fingerprint: preview.fingerprint,
    commandId,
  });
  assert.equal(result.dispatched, false);
  assert.deepEqual(dispatched, [commandId]);
  const saved = await db.calendarReconciliationRequest.findUniqueOrThrow({
    where: { id: commandId },
  });
  assert.equal(saved.status, "PENDING");
  assert.equal(await db.academicInterruption.count({ where: { title: change.title } }), 1);
  const manual = await caller.calendar.academic.changes.runPending({ year: 2033 });
  assert.deepEqual(manual, {
    pending: 1,
    dispatched: 0,
    executions: [{ id: commandId, dispatched: false }],
  });
});

void it("manual dispatch includes only pending requests in the selected year and retry dispatches failed work", async () => {
  await cleanCalendarDatabase();
  const pending = randomUUID(),
    failed = randomUUID(),
    otherYear = randomUUID();
  for (const [id, year, status] of [
    [pending, 2033, "PENDING"],
    [failed, 2033, "FAILED"],
    [otherYear, 2034, "PENDING"],
  ] as const) {
    await db.calendarReconciliationRequest.create({
      data: {
        id,
        requestedById: ADMIN.id,
        reason: `${TEST_PREFIX}Manual`,
        confirmationFingerprint: "0".repeat(64),
        status,
        fromDate: new Date(`${year}-09-01`),
        throughDate: new Date(`${year}-09-02`),
      },
    });
  }
  const ids: string[] = [];
  const caller = createCaller({
    db,
    staffUser: ADMIN,
    calendarReconciliationQueue: {
      enqueue: (id) => {
        ids.push(id);
        return Promise.resolve();
      },
    },
  });
  assert.deepEqual(await caller.calendar.academic.changes.runPending({ year: 2033 }), {
    pending: 1,
    dispatched: 1,
    executions: [{ id: pending, dispatched: true }],
  });
  assert.deepEqual(ids, [pending]);
  const retry = await caller.calendar.academic.changes.retry({ id: failed });
  assert.equal(retry.dispatched, true);
  assert.deepEqual(ids, [pending, failed]);
  const recovered = await db.calendarReconciliationRequest.findUniqueOrThrow({
    where: { id: failed },
  });
  assert.equal(recovered.status, "PENDING");
});
