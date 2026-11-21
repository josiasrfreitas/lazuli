import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import { TRPCError } from "@trpc/server";

const prefix = "Lead follow-up 176 ";
const adminId = "00000000-0000-0000-0000-000000000176";
const now = new Date("2071-02-02T01:30:00Z");
function caller(at = now): ReturnType<typeof createCaller> {
  return createCaller({
    db,
    now: at,
    staffUser: {
      id: adminId,
      name: "Lead Admin",
      email: "leads176@example.com",
      role: "ADMIN",
      isEnabled: true,
    },
  });
}
async function clean(): Promise<void> {
  await db.activityEvent.deleteMany({ where: { actorId: adminId } });
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: prefix } } });
}
before(async () => {
  await db.$connect();
  await db.user.upsert({
    where: { id: adminId },
    create: {
      id: adminId,
      name: "Lead Admin",
      email: "leads176@example.com",
      role: "ADMIN",
      isEnabled: true,
    },
    update: {},
  });
});
beforeEach(clean);
after(async () => {
  await clean();
  await db.user.delete({ where: { id: adminId } });
  await db.$disconnect();
});
async function capture(suffix: string, phone = "82999991234"): Promise<{ id: string }> {
  return caller().admissions.capture({
    lead: {
      id: randomUUID(),
      fullName: `${prefix}${suffix}`,
      phone,
      email: null,
      contactName: "Pessoa de contato",
      source: "REFERRAL" as const,
    },
  });
}
void it("captures and edits contact details without requiring or fabricating pedagogical qualification", async () => {
  const lead = await capture("Quick capture");
  await caller().admissions.details({
    id: lead.id,
    fullName: `${prefix}Updated`,
    phone: "82999994567",
    email: null,
    contactName: "Mãe do futuro aluno",
    source: "SCHOOL_VISIT",
  });
  const saved = await caller().admissions.byId(lead);
  assert.equal(saved.phone, "82999994567");
  assert.equal(saved.contactName, "Mãe do futuro aluno");
  assert.equal(saved.source, "SCHOOL_VISIT");
  assert.deepEqual(
    [saved.scheduleType, saved.format, saved.studentId, saved.enrollmentId],
    [null, null, null, null],
  );
  await assert.rejects(caller().admissions.matches({ ...lead, date: "2071-02-01" }), {
    code: "BAD_REQUEST",
    message: /Defina modalidade/,
  });
});
// The source consolidation retired next-step ownership/contact APIs in favor of lead interest
// and registration/placement. Keep the tests on the current public contract, without reviving
// the ignored historical columns or erasing their persisted data.
void it("filters captured leads by interest and lifecycle without including unrelated candidates", async () => {
  const high = await capture("High interest");
  const archived = await capture("Archived", "82999991235");
  const unknown = await capture("Unknown interest", "82999991236");
  const values = {
    id: high.id,
    fullName: `${prefix}High interest`,
    phone: "82999991234",
    email: null,
    contactName: "Pessoa de contato",
    source: "REFERRAL" as const,
    interest: "HIGH" as const,
  };
  await caller().admissions.details(values);
  await caller().admissions.setStatus({ ...archived, status: "ARCHIVED" });
  const interested = await caller().admissions.list({ search: prefix, interests: ["HIGH"] });
  assert.deepEqual(
    interested.rows.map((row) => row.id),
    [high.id],
  );
  assert.equal(interested.total, 1);
  const waiting = await caller().admissions.list({ search: prefix, statuses: ["WAITING"] });
  assert.deepEqual(waiting.rows.map((row) => row.id).toSorted(), [high.id, unknown.id].toSorted());
  assert.equal(waiting.total, 2);
  const history = await caller().admissions.list({ search: prefix, statuses: ["ARCHIVED"] });
  assert.deepEqual(
    history.rows.map((row) => row.id),
    [archived.id],
  );
});
void it("keeps captured details and attributed activity readable after archiving and rejects edits until reopening", async () => {
  const lead = await capture("History");
  const details = {
    id: lead.id,
    fullName: `${prefix}History`,
    phone: "82999994567",
    email: null,
    contactName: "Pessoa de contato",
    source: "REFERRAL" as const,
    notes: "Família pediu opções à tarde.",
  };
  await caller().admissions.details(details);
  await caller().admissions.setStatus({ ...lead, status: "ARCHIVED" });
  await assert.rejects(caller().admissions.details({ ...details, notes: "Alteração recusada" }), {
    code: "BAD_REQUEST",
    message: /Reabra o lead/,
  });
  const archived = await caller().admissions.byId(lead);
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(archived.notes, "Família pediu opções à tarde.");
  assert.equal(archived.phone, "82999994567");
  const activity = await caller().activity.list({ search: `${prefix}History`, period: "ALL" });
  assert.deepEqual(activity.rows.map((row) => row.action).toSorted(), [
    "admissions.capture",
    "admissions.details",
    "admissions.setStatus",
  ]);
  assert.deepEqual([...new Set(activity.rows.map((row) => row.actorName))], ["Lead Admin"]);
  await caller().admissions.setStatus({ ...lead, status: "WAITING" });
  await caller().admissions.details({ ...details, notes: "Retomamos o contato com a família." });
  const resumed = await caller().admissions.byId(lead);
  assert.equal(resumed.notes, "Retomamos o contato com a família.");
});
void it("rejects a future birth date using the school day without persisting a capture or success event", async () => {
  const id = randomUUID();
  await assert.rejects(
    caller().admissions.capture({
      lead: {
        id,
        fullName: `${prefix}Future birth`,
        phone: "82999991234",
        email: null,
        contactName: null,
        source: null,
        birthDate: "2071-02-02",
      },
    }),
    { code: "BAD_REQUEST", message: /nascimento.*futuro/ },
  );
  const captured = await caller().admissions.list({ search: `${prefix}Future birth` });
  assert.equal(captured.total, 0);
  const events = await caller().activity.list({ search: `${prefix}Future birth`, period: "ALL" });
  assert.equal(events.total, 0);
});

void it("protects the phone across concurrent capture and save, edits and archived leads", async () => {
  const values = {
    fullName: prefix + "Phone",
    phone: "(82) 99999-1234",
    email: null,
    notes: null,
    studentId: null,
    stageId: null,
    scheduleType: "REGULAR" as const,
    format: "ONLINE" as const,
  };
  const save = (
    phone: string | null,
    id: string = randomUUID(),
  ): ReturnType<ReturnType<typeof caller>["admissions"]["save"]> =>
    caller().admissions.save({
      id,
      values: { ...values, phone, email: "teste@example.com" },
    });
  const results = await Promise.allSettled([capture("Concurrent"), save("+55 82 99999-1234")]);
  const winners = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  assert.equal(winners.length, 1);
  const failure = results.find((result) => result.status === "rejected");
  assert.ok(failure?.reason instanceof TRPCError);
  assert.equal(failure.reason.code, "CONFLICT");
  const winner = winners[0]!;
  await caller().admissions.save({ ...winner, values });
  await caller().admissions.setStatus({ ...winner, status: "ARCHIVED" });
  const other = await save("(81) 99999-1234");
  await assert.rejects(save(values.phone, other.id), { code: "CONFLICT" });
  await assert.rejects(
    caller().admissions.details({
      ...other,
      fullName: prefix + "Other",
      phone: values.phone,
      email: null,
      contactName: null,
      source: null,
    }),
    { code: "CONFLICT", message: /Já existe um lead/ },
  );
  await save(null);
  await save(null);
  await save("+1 212 555 0123");
  await save("(12) 12555-0123");
});

void it("requires and stores the other source detail and clears it when selecting a standard source", async () => {
  const lead = await capture("Source");
  const fields = {
    ...lead,
    fullName: prefix + "Source",
    phone: null,
    email: "teste@example.com",
    contactName: null,
  };
  await assert.rejects(
    caller().admissions.details({ ...fields, source: "OTHER" }),
    /Informe a origem/,
  );
  await caller().admissions.details({ ...fields, source: "OTHER", sourceDetail: "Evento" });
  const detailed = await caller().admissions.byId(lead);
  assert.equal(detailed.sourceDetail, "Evento");
  await caller().admissions.details({ ...fields, source: "GOOGLE", sourceDetail: "Evento" });
  const standard = await caller().admissions.byId(lead);
  assert.equal(standard.sourceDetail, null);
});
