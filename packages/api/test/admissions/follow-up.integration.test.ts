import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";

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
  await db.leadContact.deleteMany({ where: { candidate: { fullName: { startsWith: prefix } } } });
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
async function capture(suffix: string): Promise<{ id: string }> {
  return caller().admissions.capture({
    id: randomUUID(),
    fullName: `${prefix}${suffix}`,
    phone: "82999991234",
    email: null,
    contactName: "Pessoa de contato",
    source: "Indicação",
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
    source: "Visita à escola",
  });
  const saved = await caller().admissions.byId(lead);
  assert.equal(saved.phone, "82999994567");
  assert.equal(saved.contactName, "Mãe do futuro aluno");
  assert.equal(saved.source, "Visita à escola");
  assert.deepEqual(
    [
      saved.scheduleType,
      saved.format,
      saved.availableUntil,
      saved.availabilityConfirmedAt,
      saved.studentId,
      saved.enrollmentId,
    ],
    [null, null, null, null, null, null],
  );
  assert.deepEqual(saved.availability, []);
  await assert.rejects(caller().admissions.matches({ ...lead, date: "2071-02-01" }), {
    code: "BAD_REQUEST",
    message: /Defina modalidade/,
  });
});
void it("queues next steps by São Paulo civil date and keeps unplanned leads separate", async () => {
  const due = await capture("Due");
  const unplanned = await capture("Unplanned");
  await caller().admissions.nextStep({
    ...due,
    ownerId: adminId,
    nextAction: "Ligar para combinar horário",
    nextActionOn: "2071-02-01",
  });
  const today = await caller().admissions.list({ search: prefix, followUp: "TODAY" });
  assert.deepEqual(
    today.rows.map((row) => row.id),
    [due.id],
  );
  assert.equal(today.rows[0]?.owner?.name, "Lead Admin");
  const later = caller(new Date("2071-02-02T12:00:00Z"));
  const overdue = await later.admissions.list({ search: prefix, followUp: "OVERDUE" });
  assert.deepEqual(
    overdue.rows.map((row) => row.id),
    [due.id],
  );
  const noStep = await later.admissions.list({ search: prefix, followUp: "UNPLANNED" });
  assert.deepEqual(
    noStep.rows.map((row) => row.id),
    [unplanned.id],
  );
});
void it("keeps one authored contact on retries and retains its history after archiving", async () => {
  const lead = await capture("History");
  const contact = {
    id: randomUUID(),
    candidateId: lead.id,
    contactedOn: "2071-02-01",
    summary: "Família pediu opções à tarde.",
  };
  const results = await Promise.all([
    caller().admissions.contact(contact),
    caller().admissions.contact(contact),
  ]);
  assert.equal(results[0].id, results[1].id);
  await caller().admissions.nextStep({
    ...lead,
    ownerId: adminId,
    nextAction: "Enviar opções",
    nextActionOn: "2071-02-03",
  });
  await caller().admissions.setStatus({ ...lead, status: "ARCHIVED" });
  const archived = await caller().admissions.byId(lead);
  assert.deepEqual([archived.nextAction, archived.nextActionOn], [null, null]);
  assert.deepEqual(
    archived.contacts.map((row) => ({ summary: row.summary, author: row.recordedBy.name })),
    [{ summary: contact.summary, author: "Lead Admin" }],
  );
  await assert.rejects(caller().admissions.contact({ ...contact, id: randomUUID() }), {
    code: "BAD_REQUEST",
    message: /Reabra o lead/,
  });
});
void it("rejects future contact history and past next steps using the school date", async () => {
  const lead = await capture("Dates");
  await assert.rejects(
    caller().admissions.contact({
      id: randomUUID(),
      candidateId: lead.id,
      contactedOn: "2071-02-02",
      summary: "Ainda não aconteceu",
    }),
    { code: "BAD_REQUEST", message: /futuro/ },
  );
  await assert.rejects(
    caller().admissions.nextStep({
      ...lead,
      ownerId: adminId,
      nextAction: "Retornar",
      nextActionOn: "2071-01-31",
    }),
    { code: "BAD_REQUEST", message: /hoje ou uma data futura/ },
  );
  const unchanged = await caller().admissions.byId(lead);
  assert.deepEqual(unchanged.contacts, []);
  assert.equal(unchanged.nextActionOn, null);
});
