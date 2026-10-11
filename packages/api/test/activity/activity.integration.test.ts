import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, beforeEach, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { activityTransaction } from "../../src/activity/record.js";

const prefix = "Activity 177 ";
const actor: StaffUser = {
  id: "00000000-0000-0000-0000-000000001777",
  name: "Activity administrator",
  email: "activity177@example.com",
  role: "ADMIN",
  isEnabled: true,
};
const now = new Date("2071-02-02T01:30:00Z");
const context = { db, staffUser: actor, now };
const caller = (): ReturnType<typeof createCaller> => createCaller(context);
async function clean(): Promise<void> {
  await db.activityEvent.deleteMany({ where: { actorId: actor.id } });
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: prefix } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: prefix } } });
}
before(async () => {
  await db.$connect();
  await db.user.upsert({ where: { id: actor.id }, create: actor, update: {} });
});
beforeEach(clean);
after(async () => {
  await clean();
  await db.user.delete({ where: { id: actor.id } });
  await db.$disconnect();
});

void it("records the actor and server time once for an idempotent capture and supports readable filters", async () => {
  const values = {
    id: randomUUID(),
    fullName: `${prefix}Lead`,
    phone: "82999991234",
    email: null,
    contactName: null,
    source: "Indicação",
  };
  await caller().admissions.capture(values);
  await caller().admissions.capture(values);
  const page = await caller().activity.list({
    search: prefix,
    area: "COMMERCIAL",
    period: "TODAY",
    actorId: actor.id,
  });
  assert.equal(page.total, 1);
  const event = page.rows[0];
  assert.ok(event);
  assert.deepEqual(
    {
      action: event.action,
      title: event.title,
      actorId: event.actorId,
      actorName: event.actorName,
      at: event.occurredAt.toISOString(),
      href: event.href,
    },
    {
      action: "admissions.capture",
      title: "Lead cadastrado",
      actorId: actor.id,
      actorName: actor.name,
      at: "2071-02-02T01:30:00.000Z",
      href: `/interessados/${values.id}`,
    },
  );
  const unrelated = await caller().activity.list({
    search: prefix,
    area: "FINANCIAL",
    period: "ALL",
  });
  assert.equal(unrelated.total, 0);
});

void it("rolls back the business write when the event cannot be recorded", async () => {
  await assert.rejects(
    activityTransaction(
      { ...context, staffUser: { ...actor, id: randomUUID() } },
      "students.create",
      (database) =>
        database.student.create({
          data: { fullName: `${prefix}Rolled back` },
          select: { id: true },
        }),
      (result) => ({ subject: { type: "student", id: result.id, name: `${prefix}Rolled back` } }),
    ),
    { code: "P2003" },
  );
  assert.equal(await db.student.count({ where: { fullName: `${prefix}Rolled back` } }), 0);
  assert.equal(await db.activityEvent.count({ where: { subjectName: `${prefix}Rolled back` } }), 0);
});

void it("lists recent actions first, paginates and leaves no event for a rejected operation", async () => {
  const values = {
    id: randomUUID(),
    fullName: `${prefix}Timeline`,
    phone: "82999994567",
    email: null,
    contactName: null,
    source: null,
  };
  await caller().admissions.capture(values);
  const later = createCaller({ ...context, now: new Date("2071-02-02T02:00:00Z") });
  await later.admissions.nextStep({
    id: values.id,
    ownerId: actor.id,
    nextAction: "Retornar ligação",
    nextActionOn: "2071-02-02",
  });
  await assert.rejects(
    later.admissions.nextStep({
      id: values.id,
      ownerId: actor.id,
      nextAction: "Data inválida",
      nextActionOn: "2071-01-31",
    }),
    { code: "BAD_REQUEST" },
  );
  const first = await later.activity.list({ search: prefix, period: "TODAY", pageSize: 1 });
  const second = await later.activity.list({
    search: prefix,
    period: "TODAY",
    pageSize: 1,
    cursor: first.nextCursor,
  });
  assert.equal(first.total, 2);
  assert.equal(first.rows[0]?.action, "admissions.nextStep");
  assert.equal(first.rows[0]?.description, "Retornar ligação");
  assert.equal(second.rows[0]?.action, "admissions.capture");
  assert.equal(second.nextCursor, null);
});

void it("keeps cursor order for simultaneous events while new activity arrives", async () => {
  for (const name of ["First", "Second", "Third"]) {
    await caller().admissions.capture({
      id: randomUUID(),
      fullName: `${prefix}${name}`,
      phone: "82999994567",
      email: null,
      contactName: null,
      source: null,
    });
  }
  const first = await caller().activity.list({ search: prefix, pageSize: 2 });
  assert.equal(first.total, 3);
  assert.equal(first.rows.length, 2);
  assert.ok(first.nextCursor);
  const later = createCaller({ ...context, now: new Date("2071-02-02T02:00:00Z") });
  await later.admissions.capture({
    id: randomUUID(),
    fullName: `${prefix}Newest`,
    phone: "82999994567",
    email: null,
    contactName: null,
    source: null,
  });
  const second = await later.activity.list({
    search: prefix,
    pageSize: 2,
    cursor: first.nextCursor,
  });
  assert.equal(second.total, 3);
  assert.equal(second.rows.length, 1);
  assert.equal(second.nextCursor, null);
  const combined = [...first.rows, ...second.rows];
  assert.deepEqual(
    combined.map((row) => row.subjectName).sort(),
    ["First", "Second", "Third"].map((name) => `${prefix}${name}`),
  );
  assert.deepEqual(
    combined.map((row) => row.id),
    combined
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  const refreshed = await later.activity.list({ search: prefix, pageSize: 2 });
  assert.equal(refreshed.total, 4);
  assert.equal(refreshed.rows[0]?.subjectName, `${prefix}Newest`);
});
