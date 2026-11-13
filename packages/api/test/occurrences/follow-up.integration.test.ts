import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanEnrollmentFixtures,
  ensureTeacherFor,
  createStudentFor,
  seedTwoStageCatalogFor,
  createPersonalizedClassFor,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";
const config = {
  prefix: "FollowUp179 ",
  catalogKey: "followup179",
  catalogKeyPrefix: "followup179",
  teacherId: "00000000-0000-0000-0000-000000001790",
  teacherEmail: "followup179@example.com",
  teacherName: "Teacher 179",
  semesterName: "FollowUp179 2074.1",
  semesterStart: "2074-02-01",
  semesterEnd: "2074-06-30",
};
const substituteId = "00000000-0000-0000-0000-000000001792";
const now = new Date("2074-02-15T21:00:00Z");
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  name: "Coordenação",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};
const teacher: StaffUser = {
  ...admin,
  id: config.teacherId,
  role: "TEACHER",
  name: config.teacherName,
  email: config.teacherEmail,
};
const caller = (staffUser = admin): ReturnType<typeof createCaller> =>
  createCaller({ db, staffUser, now });
async function clean(): Promise<void> {
  await db.classSessionRecord.deleteMany({
    where: { classSession: { class: { internalCode: { startsWith: config.prefix } } } },
  });
  const where = { student: { fullName: { startsWith: config.prefix } } };
  await db.pedagogicalFollowUp.deleteMany({
    where: { intervention: where },
  });
  await db.occurrenceRelation.deleteMany({ where: { from: where } });
  await db.interventionOccurrence.deleteMany({ where: { intervention: where } });
  await db.pedagogicalIntervention.deleteMany({ where });
  await db.pedagogicalOccurrence.deleteMany({ where });
  await db.activityEvent.deleteMany({ where: { subjectName: { startsWith: config.prefix } } });
  await db.classSubstitution.deleteMany({
    where: { class: { internalCode: { startsWith: config.prefix } } },
  });
  await db.classSession.updateMany({
    where: { class: { internalCode: { startsWith: config.prefix } } },
    data: { scheduleSlotId: null },
  });
  await db.classScheduleSlot.deleteMany({
    where: { class: { internalCode: { startsWith: config.prefix } } },
  });
  await db.teacherProfile.deleteMany({
    where: { userId: { in: [config.teacherId, substituteId] } },
  });
  await db.user.deleteMany({ where: { id: substituteId } });
  await cleanEnrollmentFixtures(config);
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
async function fixture(): Promise<{
  ana: { id: string };
  bruno: { id: string };
  session: { id: string; classId: string; date: Date; startTime: Date; endTime: Date };
  first: { id: string };
  second: { id: string };
  third: { id: string };
}> {
  await ensureTeacherFor(config);
  await db.teacherProfile.create({ data: { userId: config.teacherId } });
  const catalog = await seedTwoStageCatalogFor(config);
  const group = await createPersonalizedClassFor(config, {
    code: "A",
    semesterId: catalog.semesterId,
  });
  const [ana, bruno] = await Promise.all([
    createStudentFor(config, { suffix: "Ana" }),
    createStudentFor(config, { suffix: "Bruno" }),
  ]);
  for (const student of [ana, bruno])
    await db.enrollment.create({
      data: {
        studentId: student.id,
        classId: group.id,
        entryDate: new Date("2074-02-01"),
        progressRecords: {
          create: { stageId: catalog.firstStageId, startDate: new Date("2074-02-01") },
        },
      },
    });
  const session = await db.classSession.create({
    data: {
      classId: group.id,
      date: new Date("2074-02-14"),
      startTime: new Date("1970-01-01T18:00:00Z"),
      endTime: new Date("1970-01-01T19:00:00Z"),
    },
  });
  const report = (studentId: string, title: string): Promise<{ id: string }> =>
    caller(teacher).occurrences.create({
      studentId,
      classSessionId: session.id,
      title,
      category: "HOMEWORK",
      account: "Atividade não entregue na aula combinada.",
      initialResponse: "Organizamos juntos uma nova data.",
    });
  const first = await report(ana.id, "Primeiro relato");
  const second = await report(ana.id, "Segundo relato");
  const third = await report(bruno.id, "Relato de outro aluno");
  return { ana, bruno, session, first, second, third };
}
const interventionValues = {
  title: "Acompanhar rotina de estudos",
  treatment: "Conversamos com o aluno e organizamos as atividades em etapas menores.",
  responsibleId: config.teacherId,
  performedOn: "2074-02-14",
};
void it("lets an intervention responsible read a colleague's report without rewriting its authorship", async () => {
  const fixtureData = await fixture();
  const report = await caller().occurrences.create({
    studentId: fixtureData.ana.id,
    classSessionId: fixtureData.session.id,
    title: "Relato registrado pela coordenação",
    category: "LEARNING",
    account: "O aluno pediu apoio para acompanhar as instruções da atividade.",
  });
  await assert.rejects(caller(teacher).occurrences.byId(report), { code: "NOT_FOUND" });
  await caller().interventions.create({
    ...interventionValues,
    occurrenceIds: [report.id],
  });
  const original = await caller(teacher).occurrences.byId(report);
  assert.equal(original.canEdit, false);
  assert.equal(original.account, "O aluno pediu apoio para acompanhar as instruções da atividade.");
  assert.equal(original.recordedBy.id, admin.id);
  await assert.rejects(
    caller(teacher).occurrences.update({
      ...report,
      account: "Texto substituído pelo responsável pela intervenção.",
      expectedUpdatedAt: original.updatedAt,
    }),
    { code: "FORBIDDEN" },
  );
  const unchanged = await caller().occurrences.byId(report);
  assert.equal(unchanged.canEdit, true);
  assert.equal(
    unchanged.account,
    "O aluno pediu apoio para acompanhar as instruções da atividade.",
  );
  assert.equal(unchanged.recordedBy.id, admin.id);
  assert.equal(unchanged.updatedAt.toISOString(), original.updatedAt.toISOString());
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixtureData.ana.id, action: "occurrences.update" },
    }),
    0,
  );
});
void it("links reports symmetrically and edits the account without creating an intervention", async () => {
  const fixtureData = await fixture();
  await caller(teacher).occurrences.link({
    occurrenceId: fixtureData.first.id,
    relatedId: fixtureData.second.id,
  });
  await caller(teacher).occurrences.link({
    occurrenceId: fixtureData.second.id,
    relatedId: fixtureData.first.id,
  });
  const original = await caller(teacher).occurrences.byId(fixtureData.first);
  await caller(teacher).occurrences.update({
    id: fixtureData.first.id,
    account: "A entrega havia sido combinada para sexta.",
    expectedUpdatedAt: original.updatedAt,
  });
  await assert.rejects(
    caller(teacher).occurrences.update({
      id: fixtureData.first.id,
      account: "Uma edição antiga não deve substituir o relato atualizado.",
      expectedUpdatedAt: original.updatedAt,
    }),
    { code: "CONFLICT" },
  );
  const first = await caller().occurrences.byId(fixtureData.first);
  const second = await caller().occurrences.byId(fixtureData.second);
  assert.deepEqual(
    first.related.map((row) => row.id),
    [fixtureData.second.id],
  );
  assert.deepEqual(
    second.related.map((row) => row.id),
    [fixtureData.first.id],
  );
  assert.deepEqual(first.interventions, []);
  assert.equal(first.account, "A entrega havia sido combinada para sexta.");
  assert.equal(first.recordedBy.id, teacher.id);
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixtureData.ana.id, action: "occurrences.update" },
    }),
    1,
  );
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixtureData.ana.id, action: "occurrences.link" },
    }),
    1,
  );
});
void it("rejects missing student context, repeated reports and cross-student links without success events", async () => {
  const fixtureData = await fixture();
  for (const occurrenceIds of [
    [],
    [fixtureData.first.id, fixtureData.first.id],
    [fixtureData.first.id, fixtureData.third.id],
  ]) {
    await assert.rejects(caller().interventions.create({ ...interventionValues, occurrenceIds }), {
      code: "BAD_REQUEST",
    });
  }
  await assert.rejects(
    caller().occurrences.link({
      occurrenceId: fixtureData.first.id,
      relatedId: fixtureData.third.id,
    }),
    { code: "BAD_REQUEST", message: /mesmo aluno/ },
  );
  assert.equal(
    await db.pedagogicalIntervention.count({ where: { studentId: fixtureData.ana.id } }),
    0,
  );
  assert.equal(
    await db.activityEvent.count({
      where: {
        subjectId: fixtureData.ana.id,
        action: { in: ["interventions.create", "occurrences.link"] },
      },
    }),
    0,
  );
});
void it("records a treatment and attributed follow-ups while rejecting stale writes atomically", async () => {
  const fixtureData = await fixture();
  const intervention = await caller().interventions.create({
    ...interventionValues,
    occurrenceIds: [fixtureData.first.id, fixtureData.second.id],
  });
  const original = await caller().interventions.byId(intervention);
  assert.equal(
    original.treatment,
    "Conversamos com o aluno e organizamos as atividades em etapas menores.",
  );
  assert.equal(original.performedOn.toISOString(), "2074-02-14T00:00:00.000Z");
  assert.equal(original.responsible.id, teacher.id);
  assert.equal(original.recordedBy.id, admin.id);
  assert.deepEqual(
    original.occurrences.map((row) => row.id).toSorted(),
    [fixtureData.first.id, fixtureData.second.id].toSorted(),
  );
  await caller(teacher).interventions.followUp({
    ...intervention,
    version: 0,
    body: "Aluno entregou as duas atividades combinadas.",
  });
  await assert.rejects(
    caller(teacher).interventions.followUp({
      ...intervention,
      version: 0,
      body: "Registro enviado com uma versão desatualizada.",
    }),
    { code: "CONFLICT" },
  );
  const after = await caller().interventions.byId(intervention);
  assert.equal(after.version, 1);
  assert.deepEqual(
    after.followUps.map((row) => ({
      body: row.body,
      author: row.recordedBy.id,
      at: row.createdAt.toISOString(),
    })),
    [
      {
        body: "Aluno entregou as duas atividades combinadas.",
        author: teacher.id,
        at: "2074-02-15T21:00:00.000Z",
      },
    ],
  );
  assert.equal(
    after.treatment,
    "Conversamos com o aluno e organizamos as atividades em etapas menores.",
  );
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixtureData.ana.id, action: "interventions.followUp" },
    }),
    1,
  );
});
void it("records a standalone treatment by non-teaching staff and rejects future dates", async () => {
  const fixtureData = await fixture();
  const values = {
    ...interventionValues,
    studentId: fixtureData.ana.id,
    responsibleId: admin.id,
    occurrenceIds: [],
  };
  await assert.rejects(caller().interventions.create({ ...values, performedOn: "2074-02-16" }), {
    code: "BAD_REQUEST",
    message: /já realizada/,
  });
  const intervention = await caller().interventions.create(values);
  const row = await caller().interventions.byId(intervention);
  assert.equal(row.responsible.id, admin.id);
  assert.equal(row.performedOn.toISOString(), "2074-02-14T00:00:00.000Z");
  assert.deepEqual(row.occurrences, []);
  await caller().interventions.link({
    ...intervention,
    version: 0,
    occurrenceId: fixtureData.first.id,
  });
  const linked = await caller().interventions.byId(intervention);
  assert.deepEqual(
    linked.occurrences.map((item) => item.id),
    [fixtureData.first.id],
  );
  assert.deepEqual(linked.followUps, []);
});
void it("restricts narratives, roster and writes to the responsible teachers and administrators", async () => {
  const fixtureData = await fixture();
  const stranger = caller({ ...teacher, id: "00000000-0000-0000-0000-000000001791" });
  const unauthorizedList = await stranger.occurrences.list({});
  assert.equal(unauthorizedList.total, 0);
  assert.deepEqual(await stranger.occurrences.forStudent({ studentId: fixtureData.ana.id }), []);
  await assert.rejects(stranger.occurrences.byId(fixtureData.first), { code: "NOT_FOUND" });
  await assert.rejects(stranger.occurrences.roster({ id: fixtureData.session.id }), {
    code: "BAD_REQUEST",
  });
  await assert.rejects(
    caller(teacher).interventions.create({
      ...interventionValues,
      occurrenceIds: [fixtureData.first.id, fixtureData.second.id],
    }),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(caller({ ...admin, role: "FINANCE" }).occurrences.list({}), {
    code: "FORBIDDEN",
  });
  const intervention = await caller().interventions.create({
    ...interventionValues,
    occurrenceIds: [fixtureData.first.id, fixtureData.second.id],
  });
  const visible = await caller(teacher).interventions.byId(intervention);
  assert.equal(visible.occurrences.length, 2);
  await assert.rejects(
    stranger.interventions.followUp({
      ...intervention,
      version: 0,
      body: "Não pode acessar.",
    }),
    { code: "NOT_FOUND" },
  );
  const unchanged = await caller().interventions.byId(intervention);
  assert.equal(unchanged.version, 0);
});
void it("rejects cancelled and future sessions and students outside the session roster", async () => {
  const fixtureData = await fixture();
  const values = {
    studentId: fixtureData.ana.id,
    classSessionId: fixtureData.session.id,
    category: "OTHER" as const,
    title: "Novo relato",
    account: "Contexto que exige acompanhamento.",
  };
  await db.classSession.update({
    where: { id: fixtureData.session.id },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Aula cancelada no cenário" },
  });
  await assert.rejects(caller().occurrences.create(values), {
    code: "BAD_REQUEST",
    message: /Aula indisponível/,
  });
  await db.classSession.update({
    where: { id: fixtureData.session.id },
    data: {
      status: "SCHEDULED",
      cancelledAt: null,
      cancelReason: null,
      date: new Date("2074-02-16"),
    },
  });
  await assert.rejects(caller().occurrences.create(values), {
    code: "BAD_REQUEST",
    message: /já aconteceu/,
  });
  await db.classSession.update({
    where: { id: fixtureData.session.id },
    data: { date: new Date("2074-01-31") },
  });
  await assert.rejects(caller().occurrences.create(values), {
    code: "BAD_REQUEST",
    message: /não pertencia/,
  });
  assert.equal(
    await db.pedagogicalOccurrence.count({ where: { studentId: fixtureData.ana.id } }),
    2,
  );
});

void it("uses a substitution on the recurring slot to give only its actual teacher the reporting roster", async () => {
  const fixtureData = await fixture();
  const substitute: StaffUser = {
    ...teacher,
    id: substituteId,
    name: "Substitute 179",
    email: "substitute179@example.com",
  };
  await db.user.create({ data: substitute });
  const slot = await db.classScheduleSlot.create({
    data: {
      classId: fixtureData.session.classId,
      weekday: "WEDNESDAY",
      startTime: fixtureData.session.startTime,
      endTime: fixtureData.session.endTime,
    },
  });
  await db.classSession.update({
    where: { id: fixtureData.session.id },
    data: { scheduleSlotId: slot.id },
  });
  await db.classSubstitution.create({
    data: {
      classId: fixtureData.session.classId,
      date: fixtureData.session.date,
      scheduleSlotId: slot.id,
      teacherId: substitute.id,
      recordedById: admin.id,
    },
  });
  await assert.rejects(caller(teacher).occurrences.roster({ id: fixtureData.session.id }), {
    code: "BAD_REQUEST",
    message: /Aula indisponível/,
  });
  const roster = await caller(substitute).occurrences.roster({ id: fixtureData.session.id });
  assert.deepEqual(
    roster.map((row) => row.id).toSorted(),
    [fixtureData.ana.id, fixtureData.bruno.id].toSorted(),
  );
  const report = await caller(substitute).occurrences.create({
    studentId: fixtureData.ana.id,
    classSessionId: fixtureData.session.id,
    title: "Relato da aula substituída",
    category: "LEARNING",
    account: "Conferida a compreensão das instruções com o aluno.",
  });
  const savedReport = await caller().occurrences.byId(report);
  assert.equal(savedReport.recordedBy.id, substitute.id);
});

void it("keeps history readable but refuses new pedagogical activity after the enrollment ends", async () => {
  const fixtureData = await fixture();
  const intervention = await caller().interventions.create({
    ...interventionValues,
    studentId: fixtureData.ana.id,
    occurrenceIds: [],
  });
  await db.$transaction(async (tx) => {
    await tx.pedagogicalProgress.updateMany({
      where: { enrollment: { studentId: fixtureData.ana.id } },
      data: { endDate: new Date("2074-02-15"), endReason: "DROPPED" },
    });
    await tx.enrollment.updateMany({
      where: { studentId: fixtureData.ana.id },
      data: { exitDate: new Date("2074-02-15"), exitReason: "DROPPED" },
    });
  });
  await assert.rejects(
    caller().occurrences.create({
      studentId: fixtureData.ana.id,
      classSessionId: fixtureData.session.id,
      title: "Novo relato",
      category: "HOMEWORK",
      account: "Relato posterior ao encerramento.",
      initialResponse: "",
    }),
    { code: "BAD_REQUEST", message: /sem matrícula vigente/ },
  );
  await assert.rejects(
    caller().interventions.create({
      ...interventionValues,
      studentId: fixtureData.ana.id,
      occurrenceIds: [],
    }),
    { code: "BAD_REQUEST", message: /sem matrícula vigente/ },
  );
  const previous = await caller().interventions.byId(intervention);
  await assert.rejects(
    caller().interventions.followUp({
      id: intervention.id,
      version: previous.version,
      body: "Nova evolução após encerramento.",
    }),
    { code: "BAD_REQUEST", message: /sem matrícula vigente/ },
  );
  const unchangedReport = await caller().occurrences.byId(fixtureData.first);
  assert.equal(unchangedReport.title, "Primeiro relato");
  const unchangedIntervention = await caller().interventions.byId(intervention);
  assert.equal(unchangedIntervention.followUps.length, 0);
  assert.equal(
    await db.pedagogicalOccurrence.count({ where: { studentId: fixtureData.ana.id } }),
    2,
  );
  assert.equal(
    await db.pedagogicalIntervention.count({ where: { studentId: fixtureData.ana.id } }),
    1,
  );
});

void it("limits recent class reports to visible, undeleted records from that class", async () => {
  const data = await fixture();
  const reports = await Promise.all(
    Array.from({ length: 7 }, (_unused, index) =>
      db.pedagogicalOccurrence.create({
        data: {
          studentId: data.ana.id,
          classSessionId: data.session.id,
          recordedById: admin.id,
          title: `Recent report ${index}`,
          category: "HOMEWORK",
          account: "Atividade pendente.",
          createdAt: new Date(`2074-02-${String(16 + index).padStart(2, "0")}T12:00:00Z`),
        },
      }),
    ),
  );
  await db.pedagogicalOccurrence.update({
    where: { id: reports[6]!.id },
    data: { deletedAt: now },
  });
  const result = await caller().occurrences.recentForClass({ classId: data.session.classId });
  assert.deepEqual(
    result.map((row) => row.title),
    [
      "Recent report 5",
      "Recent report 4",
      "Recent report 3",
      "Recent report 2",
      "Recent report 1",
      "Recent report 0",
    ],
  );
  assert.equal(result[0]?.student.id, data.ana.id);
  assert.equal(result[0]?.student.fullName, `${config.prefix}Ana`);
  const visible = await caller(teacher).occurrences.recentForClass({
    classId: data.session.classId,
  });
  assert.deepEqual(
    new Set(visible.map((row) => row.id)),
    new Set([data.first.id, data.second.id, data.third.id]),
  );
  const unrelated = await caller().occurrences.recentForClass({
    classId: "00000000-0000-0000-0000-000000000001",
  });
  assert.deepEqual(unrelated, []);
});

void it("persists an outside-class event and includes it in student follow-up without a lesson", async () => {
  const data = await fixture();
  const report = await caller(teacher).occurrences.create({
    studentId: data.ana.id,
    occurredOn: "2074-02-13",
    occurredTime: "23:45",
    title: "Fora de Aula",
    category: "OTHER",
    account: "Conflito durante o evento cultural.",
  });
  const detail = await caller(teacher).occurrences.byId(report);
  assert.equal(detail.classSession, null);
  assert.equal(detail.occurredOn?.toISOString(), "2074-02-13T00:00:00.000Z");
  assert.equal(detail.occurredTime, "23:45");
  assert.equal(detail.account, "Conflito durante o evento cultural.");
  assert.equal(detail.recordedBy.id, teacher.id);
  const listing = await caller(teacher).occurrences.list({ studentId: data.ana.id });
  assert.equal(
    listing.rows.some((row) => row.id === report.id),
    true,
  );
  const unrelated = await createStudentFor(config, { suffix: "Sem vínculo" });
  await assert.rejects(
    caller(teacher).occurrences.create({
      studentId: unrelated.id,
      occurredOn: "2074-02-13",
      occurredTime: "12:00",
      title: "Fora de Aula",
      category: "OTHER",
      account: "Evento sem acesso.",
    }),
    { code: "BAD_REQUEST" },
  );
});

void it("counts monthly teaching hours only after a completed record", async () => {
  const { teacherMonthlyHours } = await import("../../src/teachers/monthly-hours.js");
  const data = await fixture();
  const read = async () =>
    (await teacherMonthlyHours(db, { teacherIds: [teacher.id], now })).get(teacher.id);
  assert.deepEqual(await read(), { plannedMinutes: 60, completedMinutes: 0 });
  await db.classSession.update({
    where: { id: data.session.id },
    data: { attendanceConfirmedAt: now },
  });
  assert.equal((await read())?.completedMinutes, 0);
  await db.classSessionRecord.create({
    data: { classSessionId: data.session.id, teachingTeacherId: teacher.id, snapshot: {} },
  });
  assert.deepEqual(await read(), { plannedMinutes: 60, completedMinutes: 60 });
  await db.classSession.update({
    where: { id: data.session.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: "Cancelamento no cenário",
      attendanceConfirmedAt: null,
    },
  });
  assert.deepEqual(await read(), { plannedMinutes: 0, completedMinutes: 0 });
});
