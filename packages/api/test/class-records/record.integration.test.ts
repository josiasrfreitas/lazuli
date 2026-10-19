import assert from "node:assert/strict";
import { beforeEach, after, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanEnrollmentFixtures,
  ensureTeacherFor,
  createStudentFor,
  seedTwoStageCatalogFor,
  createPersonalizedClassFor,
  createRegularClassFor,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";
const config = {
  prefix: "Records181 ",
  catalogKey: "records181",
  catalogKeyPrefix: "records181",
  teacherId: "00000000-0000-0000-0000-000000001810",
  teacherEmail: "records181@example.com",
  teacherName: "Records Teacher",
  semesterName: "Records181 2076.1",
  semesterStart: "2076-02-01",
  semesterEnd: "2076-06-30",
};
const substituteId = "00000000-0000-0000-0000-000000001811";
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  role: "ADMIN",
  name: "Coordenação",
  email: "admin@example.com",
  isEnabled: true,
};
const teacher: StaffUser = {
  ...admin,
  id: config.teacherId,
  role: "TEACHER",
  name: config.teacherName,
};
const caller = (now = "2076-02-15T14:00:00Z", staffUser = admin) =>
  createCaller({ db, staffUser, now: new Date(now) });
const content = {
  kind: "REVIEW" as const,
  account: "Retomamos perguntas sobre a rotina em duplas.",
  reference: null,
  pageFrom: null,
  pageTo: null,
};
async function clean() {
  const group = { internalCode: { startsWith: config.prefix } };
  await db.classSessionRecordRevision.deleteMany({
    where: { record: { classSession: { class: group } } },
  });
  await db.classSessionRecord.deleteMany({ where: { classSession: { class: group } } });
  await db.classSubstitution.deleteMany({ where: { class: group } });
  await db.stagePlanRevision.deleteMany({ where: { plan: { class: group } } });
  await db.stagePlanItem.deleteMany({ where: { plan: { class: group } } });
  await db.stagePlan.deleteMany({ where: { class: group } });
  await db.activityEvent.deleteMany({
    where: {
      OR: [
        { subjectName: { startsWith: config.prefix } },
        { actorId: { in: [config.teacherId, substituteId] } },
      ],
    },
  });
  await cleanEnrollmentFixtures(config);
  await db.user.deleteMany({ where: { id: substituteId } });
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
async function fixture(regular = true) {
  await ensureTeacherFor(config);
  const catalog = await seedTwoStageCatalogFor(config);
  const group = regular
    ? await createRegularClassFor(config, {
        code: "A",
        semesterId: catalog.semesterId,
        sharedStageId: catalog.firstStageId,
      })
    : await createPersonalizedClassFor(config, { code: "A", semesterId: catalog.semesterId });
  const students = await Promise.all(
    ["Ana", "Bia"].map((suffix) => createStudentFor(config, { suffix })),
  );
  const enrollments = [];
  for (const student of students)
    enrollments.push(
      await caller("2076-02-01T12:00:00Z").enrollment.create({
        studentId: student.id,
        classId: group.id,
        ...(regular ? {} : { stageId: catalog.firstStageId }),
      }),
    );
  const session = await db.classSession.create({
    data: {
      classId: group.id,
      date: new Date("2076-02-15"),
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T10:00:00Z"),
    },
  });
  return {
    catalog,
    group,
    session,
    students,
    enrollments,
    rows: enrollments.map((entry) => ({
      enrollmentId: entry.enrollment.id,
      status: "PRESENT" as const,
      content: regular ? null : content,
    })),
  };
}
void it("closes manual attendance with page-free regular content and preserves the plan intended at the encounter", async () => {
  const f = await fixture();
  const target = { classId: f.group.id };
  await caller("2076-02-10T12:00:00Z").planning.saveWindow({
    ...target,
    version: 0,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: null,
  });
  await caller("2076-02-10T12:00:00Z").planning.saveItem({
    ...target,
    version: 1,
    plannedOn: "2076-02-15",
    kind: "CONTENT",
    title: "Novas perguntas do livro",
    reference: "Unit 2",
    pageFrom: 12,
    pageTo: 14,
  });
  const input = {
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    rows: f.rows,
    sharedContent: content,
    note: null,
  };
  await assert.rejects(caller().classRecords.save({ ...input, sharedContent: null }), {
    code: "BAD_REQUEST",
    message: /conteúdo realizado/,
  });
  assert.equal(await db.attendance.count({ where: { classSessionId: f.session.id } }), 0);
  await caller().classRecords.save(input);
  await caller("2076-02-16T12:00:00Z").planning.saveWindow({
    ...target,
    version: 2,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: "Objetivo alterado depois da aula.",
    reason: "Reorganização posterior.",
  });
  const record = await caller().classRecords.detail({ sessionId: f.session.id });
  assert.equal(record.snapshot.sharedContent?.kind, "REVIEW");
  assert.equal(record.snapshot.sharedContent?.pageFrom, null);
  assert.deepEqual(
    record.snapshot.sharedPlanned?.items.map((row) => row.title),
    ["Novas perguntas do livro"],
  );
  assert.equal(record.snapshot.sharedPlanned?.version, 2);
  assert.deepEqual(
    record.snapshot.entries.map((row) => row.status),
    ["PRESENT", "PRESENT"],
  );
  const attendance = await db.attendance.findMany({ where: { classSessionId: f.session.id } });
  assert.equal(attendance.length, 2);
  assert.deepEqual(
    attendance.map((row) => row.recordedById),
    [admin.id, admin.id],
  );
  assert.equal(
    await db.pedagogicalProgress.count({
      where: {
        enrollmentId: { in: f.rows.map((row) => row.enrollmentId) },
        endDate: { not: null },
      },
    }),
    0,
  );
  assert.equal(
    await db.stageAssessment.count({
      where: { studentId: { in: f.students.map((student) => student.id) } },
    }),
    0,
  );
});
void it("corrects PPT presence and actual content together while retaining the attributed original and rejecting stale or legacy writes", async () => {
  const f = await fixture(false);
  const input = {
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    rows: f.rows,
    sharedContent: null,
    note: null,
  };
  await assert.rejects(
    caller().classRecords.save({
      ...input,
      rows: f.rows.map((row, index) => ({ ...row, content: index === 0 ? null : content })),
    }),
    { code: "BAD_REQUEST", message: /Descreva o realizado/ },
  );
  assert.equal(await db.classSessionRecord.count({ where: { classSessionId: f.session.id } }), 0);
  await caller().classRecords.save(input);
  const first = await caller().classRecords.detail({ sessionId: f.session.id });
  const correction = {
    ...input,
    version: 1,
    attendanceStamp: first.attendanceStamp,
    rows: f.rows.map((row, index) =>
      index === 0 ? { ...row, status: "ABSENT" as const, content: null } : row,
    ),
    reason: "Ana não participou; chamada conferida com o professor.",
  };
  await caller("2076-02-16T14:00:00Z").classRecords.save(correction);
  await assert.rejects(caller().classRecords.save(correction), { code: "CONFLICT" });
  await assert.rejects(
    caller().attendance.editSession({
      sessionId: f.session.id,
      rows: [{ enrollmentId: f.rows[0]!.enrollmentId, status: "PRESENT" }],
    }),
    { code: "BAD_REQUEST", message: /pelo registro da aula/ },
  );
  const current = await caller().classRecords.detail({ sessionId: f.session.id });
  assert.equal(current.snapshot.entries[0]?.status, "ABSENT");
  assert.equal(current.snapshot.entries[0]?.content, null);
  const history = await caller().classRecords.history({
    sessionId: f.session.id,
    direction: "forward",
  });
  assert.deepEqual(
    history.items.map((row) => row.version),
    [2, 1],
  );
  assert.equal(history.items[1]?.snapshot.entries[0]?.status, "PRESENT");
  assert.equal(history.items[1]?.snapshot.entries[0]?.content?.account, content.account);
  assert.equal(history.items[0]?.reason, correction.reason);
  assert.equal(history.items[0]?.authorId, admin.id);
  assert.equal(
    await db.activityEvent.count({
      where: {
        subjectId: f.group.id,
        action: { in: ["classRecords.confirm", "classRecords.correct"] },
      },
    }),
    2,
  );
});
void it("requires an observation for no-present classes and rejects cancelled, unfinished and off-roster submissions", async () => {
  const f = await fixture();
  const upcoming = await caller("2076-02-15T12:59:00Z").classRecords.list({
    from: "2076-02-15",
    to: "2076-02-15",
  });
  assert.equal(upcoming.find((row) => row.id === f.session.id)?.state, "UPCOMING");
  const input = {
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    rows: f.rows.map((row) => ({ ...row, status: "ABSENT" as const })),
    sharedContent: null,
    note: null,
  };
  await assert.rejects(caller().classRecords.save(input), {
    code: "BAD_REQUEST",
    message: /observação/,
  });
  await assert.rejects(
    caller("2076-02-15T12:59:00Z").classRecords.save({ ...input, note: "Sem presentes." }),
    { code: "BAD_REQUEST", message: /término/ },
  );
  await assert.rejects(caller().classRecords.save({ ...input, rows: [], note: "Sem presentes." }), {
    code: "BAD_REQUEST",
    message: /lista de alunos mudou/,
  });
  await db.classSession.update({
    where: { id: f.session.id },
    data: { status: "CANCELLED", cancelReason: "Fechamento extraordinário." },
  });
  await assert.rejects(caller().classRecords.save({ ...input, note: "Sem presentes." }), {
    code: "BAD_REQUEST",
    message: /cancelada/,
  });
  assert.equal(await db.attendance.count({ where: { classSessionId: f.session.id } }), 0);
  await db.classSession.update({
    where: { id: f.session.id },
    data: { status: "SCHEDULED", cancelReason: null },
  });
  await caller().classRecords.save({
    ...input,
    note: "Os alunos não compareceram; a coordenação fará contato.",
  });
  const detail = await caller().classRecords.detail({ sessionId: f.session.id });
  assert.equal(detail.snapshot.sharedContent, null);
  assert.deepEqual(
    detail.snapshot.entries.map((row) => row.status),
    ["ABSENT", "ABSENT"],
  );
});
void it("authorizes the dated substitute, freezes responsibility and keeps teacher corrections on the session day", async () => {
  const f = await fixture();
  await db.user.create({
    data: {
      id: substituteId,
      name: "Substituta",
      email: "substitute181@example.com",
      role: "TEACHER",
      isEnabled: true,
    },
  });
  await db.classSubstitution.create({
    data: {
      classId: f.group.id,
      classSessionId: f.session.id,
      date: f.session.date,
      teacherId: substituteId,
      recordedById: admin.id,
    },
  });
  const substitute = { ...teacher, id: substituteId, name: "Substituta" };
  await assert.rejects(
    caller(undefined, teacher).classRecords.detail({ sessionId: f.session.id }),
    { code: "FORBIDDEN" },
  );
  const input = {
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    rows: f.rows,
    sharedContent: content,
    note: null,
  };
  await caller(undefined, substitute).classRecords.save(input);
  const detail = await caller(undefined, substitute).classRecords.detail({
    sessionId: f.session.id,
  });
  assert.equal(detail.session.teacher, "Substituta");
  const stored = await db.classSession.findUniqueOrThrow({
    where: { id: f.session.id },
    include: { classRecord: true },
  });
  assert.equal(stored.usualTeacherId, config.teacherId);
  assert.equal(stored.classRecord?.teachingTeacherId, substituteId);
  await assert.rejects(
    caller("2076-02-16T14:00:00Z", substitute).classRecords.save({
      ...input,
      version: 1,
      attendanceStamp: detail.attendanceStamp,
      reason: "Correção tardia.",
      note: "Novo registro.",
    }),
    { code: "BAD_REQUEST", message: /administração/ },
  );
  await assert.rejects(
    caller(undefined, { ...admin, role: "FINANCE" }).classRecords.detail({
      sessionId: f.session.id,
    }),
    { code: "FORBIDDEN" },
  );
  const history = await caller().classRecords.history({ sessionId: f.session.id });
  assert.equal(history.items[0]?.author, "Substituta");
});

void it("detects an intervening attendance-only write and preserves its original statuses when completing with a justified correction", async () => {
  const f = await fixture();
  await caller("2076-02-15T13:10:00Z").attendance.confirmSession({
    sessionId: f.session.id,
    rows: [],
  });
  const opened = await caller().classRecords.detail({ sessionId: f.session.id });
  await caller("2076-02-15T13:20:00Z").attendance.editSession({
    sessionId: f.session.id,
    rows: [{ enrollmentId: f.rows[0]!.enrollmentId, status: "ABSENT" }],
  });
  const input = {
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: opened.attendanceStamp,
    rows: f.rows,
    sharedContent: content,
    note: null,
  };
  await assert.rejects(caller().classRecords.save(input), { code: "CONFLICT" });
  const refreshed = await caller().classRecords.detail({ sessionId: f.session.id });
  await assert.rejects(
    caller().classRecords.save({ ...input, attendanceStamp: refreshed.attendanceStamp }),
    { code: "BAD_REQUEST", message: /motivo para corrigir/ },
  );
  assert.equal(await db.classSessionRecord.count({ where: { classSessionId: f.session.id } }), 0);
  await caller().classRecords.save({
    ...input,
    attendanceStamp: refreshed.attendanceStamp,
    reason: "Presença conferida pessoalmente antes da baixa.",
  });
  const history = await caller().classRecords.history({ sessionId: f.session.id });
  assert.deepEqual(
    history.items.map((row) => row.version),
    [2, 1],
  );
  assert.equal(history.items[1]?.snapshot.entries[0]?.status, "ABSENT");
  assert.equal(history.items[1]?.snapshot.sharedContent, null);
  assert.equal(history.items[0]?.snapshot.entries[0]?.status, "PRESENT");
  assert.equal(history.items[0]?.snapshot.sharedContent?.account, content.account);
  const session = await db.classSession.findUniqueOrThrow({ where: { id: f.session.id } });
  assert.equal(session.attendanceConfirmedAt?.toISOString(), "2076-02-15T13:10:00.000Z");
});

void it("exposes the regular class stage in the calendar without assigning a shared stage to PPT", async () => {
  const f = await fixture();
  const personalized = await createPersonalizedClassFor(config, {
    code: "PPT-calendar",
    semesterId: f.catalog.semesterId,
  });
  await db.classSession.create({
    data: {
      classId: personalized.id,
      date: new Date("2076-02-15"),
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T10:00:00Z"),
    },
  });
  const stage = await db.stage.findUniqueOrThrow({ where: { id: f.catalog.firstStageId } });
  const rows = await caller().classRecords.list({ from: "2076-02-15", to: "2076-02-15" });
  assert.equal(rows.find((row) => row.classId === f.group.id)?.stageName, stage.name);
  assert.equal(rows.find((row) => row.classId === personalized.id)?.stageName, null);
});

void it("exposes performed content in planning without replacing it with the planned pages", async () => {
  const f = await fixture();
  await caller().planning.saveWindow({
    classId: f.group.id,
    version: 0,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: null,
  });
  await caller().planning.saveItem({
    classId: f.group.id,
    version: 1,
    plannedOn: "2076-02-15",
    kind: "CONTENT",
    title: "Leitura prevista",
    reference: "Livro",
    pageFrom: 12,
    pageTo: 14,
  });
  assert.deepEqual((await caller().planning.detail({ classId: f.group.id })).records, []);
  await caller().classRecords.save({
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    rows: f.rows,
    sharedContent: { ...content, pageFrom: 6, pageTo: 7 },
    note: null,
  });
  const detail = await caller().planning.detail({ classId: f.group.id });
  assert.deepEqual(detail.records, [
    {
      id: f.session.id,
      classId: f.group.id,
      date: "2076-02-15",
      time: "09:00",
      content: { ...content, pageFrom: 6, pageTo: 7 },
    },
  ]);
  assert.equal(detail.plan?.items[0]?.pageTo, 14);
});
