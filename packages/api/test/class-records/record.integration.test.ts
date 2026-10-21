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
const caller = (now = "2076-02-15T14:00:00Z", staffUser = admin): ReturnType<typeof createCaller> =>
  createCaller({ db, staffUser, now: new Date(now) });
const content = {
  kind: "REVIEW" as const,
  account: "Retomamos perguntas sobre a rotina em duplas.",
  reference: null,
  pageFrom: null,
  pageTo: null,
};
async function clean(): Promise<void> {
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
type Fixture = {
  catalog: Awaited<ReturnType<typeof seedTwoStageCatalogFor>>;
  group:
    | Awaited<ReturnType<typeof createRegularClassFor>>
    | Awaited<ReturnType<typeof createPersonalizedClassFor>>;
  students: Awaited<ReturnType<typeof createStudentFor>>[];
  session: Awaited<ReturnType<typeof db.classSession.create>>;
  enrollments: Awaited<ReturnType<ReturnType<typeof createCaller>["enrollment"]["create"]>>[];
  rows: { enrollmentId: string; status: "PRESENT"; content: typeof content | null }[];
};
async function fixture(regular = true): Promise<Fixture> {
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
  const fixtureData = await fixture();
  const target = { classId: fixtureData.group.id };
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
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: content,
    note: null,
  };
  await assert.rejects(caller().classRecords.save({ ...input, sharedContent: null }), {
    code: "BAD_REQUEST",
    message: /conteúdo realizado/,
  });
  assert.equal(await db.attendance.count({ where: { classSessionId: fixtureData.session.id } }), 0);
  await caller().classRecords.save(input);
  await caller("2076-02-16T12:00:00Z").planning.saveWindow({
    ...target,
    version: 2,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: "Objetivo alterado depois da aula.",
    reason: "Reorganização posterior.",
  });
  const record = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
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
  const attendance = await db.attendance.findMany({
    where: { classSessionId: fixtureData.session.id },
  });
  assert.equal(attendance.length, 2);
  assert.deepEqual(
    attendance.map((row) => row.recordedById),
    [admin.id, admin.id],
  );
  assert.equal(
    await db.pedagogicalProgress.count({
      where: {
        enrollmentId: { in: fixtureData.rows.map((row) => row.enrollmentId) },
        endDate: { not: null },
      },
    }),
    0,
  );
  assert.equal(
    await db.order.count({
      where: {
        beneficiaries: {
          some: { studentId: { in: fixtureData.students.map((student) => student.id) } },
        },
      },
    }),
    0,
  );
});
void it("corrects PPT presence and actual content together while retaining the attributed original and rejecting stale or legacy writes", async () => {
  const fixtureData = await fixture(false);
  const input = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: null,
    note: null,
  };
  await assert.rejects(
    caller().classRecords.save({
      ...input,
      rows: fixtureData.rows.map((row, index) => ({
        ...row,
        content: index === 0 ? null : content,
      })),
    }),
    { code: "BAD_REQUEST", message: /Descreva o realizado/ },
  );
  assert.equal(
    await db.classSessionRecord.count({ where: { classSessionId: fixtureData.session.id } }),
    0,
  );
  await caller().classRecords.save(input);
  const first = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  const correction = {
    ...input,
    version: 1,
    attendanceStamp: first.attendanceStamp,
    rows: fixtureData.rows.map((row, index) =>
      index === 0 ? { ...row, status: "ABSENT" as const, content: null } : row,
    ),
    reason: "Ana não participou; chamada conferida com o professor.",
  };
  await caller("2076-02-16T14:00:00Z").classRecords.save(correction);
  await assert.rejects(caller().classRecords.save(correction), { code: "CONFLICT" });
  await assert.rejects(
    caller().attendance.editSession({
      sessionId: fixtureData.session.id,
      rows: [{ enrollmentId: fixtureData.rows[0]!.enrollmentId, status: "PRESENT" }],
    }),
    { code: "BAD_REQUEST", message: /pelo registro da aula/ },
  );
  const current = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(current.snapshot.entries[0]?.status, "ABSENT");
  assert.equal(current.snapshot.entries[0]?.content, null);
  const history = await caller().classRecords.history({
    sessionId: fixtureData.session.id,
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
        subjectId: fixtureData.group.id,
        action: { in: ["classRecords.confirm", "classRecords.correct"] },
      },
    }),
    2,
  );
});
void it("requires an observation for no-present classes and rejects cancelled, unfinished and off-roster submissions", async () => {
  const fixtureData = await fixture();
  const upcoming = await caller("2076-02-15T12:59:00Z").classRecords.list({
    from: "2076-02-15",
    to: "2076-02-15",
  });
  assert.equal(upcoming.find((row) => row.id === fixtureData.session.id)?.state, "UPCOMING");
  const input = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows.map((row) => ({ ...row, status: "ABSENT" as const })),
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
    where: { id: fixtureData.session.id },
    data: {
      status: "CANCELLED",
      cancelReason: "Fechamento extraordinário.",
      cancelledAt: new Date("2076-02-15T13:00:00Z"),
    },
  });
  await assert.rejects(caller().classRecords.save({ ...input, note: "Sem presentes." }), {
    code: "BAD_REQUEST",
    message: /cancelada/,
  });
  assert.equal(await db.attendance.count({ where: { classSessionId: fixtureData.session.id } }), 0);
  await db.classSession.update({
    where: { id: fixtureData.session.id },
    data: { status: "SCHEDULED", cancelReason: null, cancelledAt: null },
  });
  await caller().classRecords.save({
    ...input,
    note: "Os alunos não compareceram; a coordenação fará contato.",
  });
  const detail = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(detail.snapshot.sharedContent, null);
  assert.deepEqual(
    detail.snapshot.entries.map((row) => row.status),
    ["ABSENT", "ABSENT"],
  );
});
void it("authorizes the dated substitute, freezes responsibility and keeps teacher corrections on the session day", async () => {
  const fixtureData = await fixture();
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
      classId: fixtureData.group.id,
      classSessionId: fixtureData.session.id,
      date: fixtureData.session.date,
      teacherId: substituteId,
      recordedById: admin.id,
    },
  });
  const substitute = { ...teacher, id: substituteId, name: "Substituta" };
  const unassignedPending = await caller(undefined, teacher).classRecords.pending({ page: 1 });
  assert.equal(unassignedPending.total, 0);
  const assignedPending = await caller(undefined, substitute).classRecords.pending({ page: 1 });
  assert.equal(assignedPending.total, 1);
  assert.equal(assignedPending.rows[0]?.id, fixtureData.session.id);
  await assert.rejects(
    caller(undefined, teacher).classRecords.detail({ sessionId: fixtureData.session.id }),
    { code: "FORBIDDEN" },
  );
  const input = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: content,
    note: null,
  };
  await caller(undefined, substitute).classRecords.save(input);
  const detail = await caller(undefined, substitute).classRecords.detail({
    sessionId: fixtureData.session.id,
  });
  assert.equal(detail.session.teacher, "Substituta");
  const stored = await db.classSession.findUniqueOrThrow({
    where: { id: fixtureData.session.id },
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
      sessionId: fixtureData.session.id,
    }),
    { code: "FORBIDDEN" },
  );
  const history = await caller().classRecords.history({ sessionId: fixtureData.session.id });
  assert.equal(history.items[0]?.author, "Substituta");
});

void it("detects an intervening attendance-only write and preserves its original statuses when completing with a justified correction", async () => {
  const fixtureData = await fixture();
  await caller("2076-02-15T13:10:00Z", teacher).attendance.confirmSession({
    sessionId: fixtureData.session.id,
    rows: [],
  });
  const opened = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  await caller("2076-02-15T13:20:00Z").attendance.editSession({
    sessionId: fixtureData.session.id,
    rows: [{ enrollmentId: fixtureData.rows[0]!.enrollmentId, status: "ABSENT" }],
  });
  const input = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: opened.attendanceStamp,
    rows: fixtureData.rows,
    sharedContent: content,
    note: null,
  };
  await assert.rejects(caller().classRecords.save(input), { code: "CONFLICT" });
  const refreshed = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  await assert.rejects(
    caller().classRecords.save({ ...input, attendanceStamp: refreshed.attendanceStamp }),
    { code: "BAD_REQUEST", message: /motivo para corrigir/ },
  );
  assert.equal(
    await db.classSessionRecord.count({ where: { classSessionId: fixtureData.session.id } }),
    0,
  );
  const attendanceBefore = await db.attendance.findFirstOrThrow({
    where: {
      classSessionId: fixtureData.session.id,
      enrollmentId: fixtureData.rows[0]!.enrollmentId,
    },
  });
  await caller().classRecords.save({
    ...input,
    attendanceStamp: refreshed.attendanceStamp,
    reason: "Presença conferida pessoalmente antes da baixa.",
  });
  const history = await caller().classRecords.history({ sessionId: fixtureData.session.id });
  assert.deepEqual(
    history.items.map((row) => row.version),
    [2, 1],
  );
  const original = history.items[1]!;
  const corrected = history.items[0]!;
  assert.equal(original.snapshot.entries[0]!.status, "ABSENT");
  assert.equal(original.authorId, teacher.id);
  assert.equal(original.recordedAt.toISOString(), "2076-02-15T13:10:00.000Z");
  assert.equal(corrected.authorId, admin.id);
  assert.equal(corrected.recordedAt.toISOString(), "2076-02-15T14:00:00.000Z");
  const originalAttendance = original.snapshot.attendanceOrigin!.entries.find(
    (row) => row.enrollmentId === fixtureData.rows[0]!.enrollmentId,
  )!;
  assert.equal(originalAttendance.recordedBy!.id, teacher.id);
  assert.equal(originalAttendance.recordedAt, attendanceBefore.recordedAt.toISOString());
  assert.equal(originalAttendance.modifiedBy!.id, admin.id);
  assert.equal(originalAttendance.modifiedAt, "2076-02-15T13:20:00.000Z");
  assert.equal(original.snapshot.sharedContent, null);
  assert.equal(corrected.snapshot.entries[0]?.status, "PRESENT");
  assert.equal(corrected.snapshot.sharedContent?.account, content.account);
  const session = await db.classSession.findUniqueOrThrow({
    where: { id: fixtureData.session.id },
  });
  assert.equal(session.attendanceConfirmedAt?.toISOString(), "2076-02-15T13:10:00.000Z");
});

void it("exposes the regular class stage in the calendar without assigning a shared stage to PPT", async () => {
  const fixtureData = await fixture();
  const personalized = await createPersonalizedClassFor(config, {
    code: "PPT-calendar",
    semesterId: fixtureData.catalog.semesterId,
  });
  await db.classSession.create({
    data: {
      classId: personalized.id,
      date: new Date("2076-02-15"),
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T10:00:00Z"),
    },
  });
  const stage = await db.stage.findUniqueOrThrow({
    where: { id: fixtureData.catalog.firstStageId },
  });
  const rows = await caller().classRecords.list({ from: "2076-02-15", to: "2076-02-15" });
  assert.equal(rows.find((row) => row.classId === fixtureData.group.id)?.stageName, stage.name);
  assert.equal(rows.find((row) => row.classId === personalized.id)?.stageName, null);
});

void it("exposes performed content in planning without replacing it with the planned pages", async () => {
  const fixtureData = await fixture();
  await caller().planning.saveWindow({
    classId: fixtureData.group.id,
    version: 0,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: null,
  });
  await caller().planning.saveItem({
    classId: fixtureData.group.id,
    version: 1,
    plannedOn: "2076-02-15",
    kind: "CONTENT",
    title: "Leitura prevista",
    reference: "Livro",
    pageFrom: 12,
    pageTo: 14,
  });
  const planBeforeRecord = await caller().planning.detail({ classId: fixtureData.group.id });
  assert.deepEqual(planBeforeRecord.records, []);
  await caller().classRecords.save({
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: { ...content, pageFrom: 6, pageTo: 7 },
    note: null,
  });
  const detail = await caller().planning.detail({ classId: fixtureData.group.id });
  assert.deepEqual(detail.records, [
    {
      id: fixtureData.session.id,
      classId: fixtureData.group.id,
      date: "2076-02-15",
      time: "09:00",
      content: { ...content, pageFrom: 6, pageTo: 7 },
    },
  ]);
  assert.equal(detail.plan?.items[0]?.pageTo, 14);
});

void it("lets the responsible teacher close an overdue first record without granting late correction", async () => {
  const fixtureData = await fixture();
  const overdue = caller("2076-03-17T14:00:00Z", teacher);
  const pending = await overdue.classRecords.pending({ page: 1 });
  assert.equal(pending.total, 1);
  assert.equal(pending.rows[0]?.id, fixtureData.session.id);
  const before = await overdue.classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(before.restriction, null);
  await overdue.classRecords.save({
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: content,
    note: null,
  });
  const saved = await overdue.classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(saved.version, 1);
  const pendingAfterRecord = await overdue.classRecords.pending({ page: 1 });
  assert.equal(pendingAfterRecord.total, 0);
  assert.match(saved.restriction ?? "", /administração pode corrigir/);
  const history = await overdue.classRecords.history({ sessionId: fixtureData.session.id });
  assert.equal(history.items[0]?.authorId, teacher.id);
  assert.equal(history.items[0]?.recordedAt.toISOString(), "2076-03-17T14:00:00.000Z");
  await assert.rejects(
    overdue.classRecords.save({
      sessionId: fixtureData.session.id,
      version: saved.version,
      attendanceStamp: saved.attendanceStamp,
      rows: fixtureData.rows,
      sharedContent: content,
      note: "Tentativa fora do prazo de correção.",
      reason: "Correção atrasada.",
    }),
    { code: "BAD_REQUEST", message: /administração pode corrigir/ },
  );
});

void it("retains a retired linked step and its recorded label while correcting the account", async () => {
  const fixtureData = await fixture();
  const target = { classId: fixtureData.group.id };
  await caller().planning.saveWindow({
    ...target,
    version: 0,
    plannedStartOn: "2076-02-01",
    plannedEndOn: "2076-06-30",
    objective: null,
  });
  await caller().planning.saveItem({
    ...target,
    version: 1,
    plannedOn: "2076-02-15",
    kind: "REVIEW",
    title: "Perguntas sobre a rotina",
    reference: null,
    pageFrom: null,
    pageTo: null,
  });
  const planBeforeRetirement = await caller().planning.detail(target);
  const item = planBeforeRetirement.plan!.items[0]!;
  const values = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: null,
    rows: fixtureData.rows,
    sharedContent: { ...content, planItemId: item.id },
    note: null,
  };
  await caller().classRecords.save(values);
  const recorded = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  await caller().planning.removeItem({
    ...target,
    version: 2,
    itemId: item.id,
    reason: "Etapa retirada do planejamento atual.",
  });
  await caller().classRecords.save({
    ...values,
    version: 1,
    attendanceStamp: recorded.attendanceStamp,
    sharedContent: recorded.snapshot.sharedContent,
    note: "Observação posterior ao encontro.",
    reason: "Detalhar o contexto.",
  });
  const corrected = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(corrected.version, 2);
  assert.equal(corrected.snapshot.sharedContent?.planItemId, item.id);
  assert.equal(corrected.snapshot.sharedContent?.planItemTitle, "Perguntas sobre a rotina");
  const planAfterRetirement = await caller().planning.detail(target);
  assert.equal(planAfterRetirement.plan?.items.length, 0);
});

void it("allows overdue narrative completion but reserves changes to confirmed attendance for administration", async () => {
  const fixtureData = await fixture();
  await caller("2076-02-15T13:10:00Z").attendance.confirmSession({
    sessionId: fixtureData.session.id,
    rows: [],
  });
  const overdue = caller("2076-02-16T14:00:00Z", teacher);
  const before = await overdue.classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(before.attendanceReadOnly, true);
  const input = {
    sessionId: fixtureData.session.id,
    version: 0,
    attendanceStamp: before.attendanceStamp,
    rows: fixtureData.rows,
    sharedContent: content,
    note: null,
  };
  const correction = {
    ...input,
    rows: fixtureData.rows.map((row, index) =>
      index === 0 ? { ...row, status: "ABSENT" as const } : row,
    ),
    reason: "Presença revisada pela administração.",
  };
  await assert.rejects(overdue.classRecords.save(correction), { code: "FORBIDDEN" });
  const unchanged = await overdue.classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(unchanged.version, 0);
  assert.equal(unchanged.attendanceStamp, before.attendanceStamp);
  assert.deepEqual(
    unchanged.snapshot.entries.map((row) => row.status),
    ["PRESENT", "PRESENT"],
  );
  await overdue.classRecords.save(input);
  const completed = await overdue.classRecords.detail({ sessionId: fixtureData.session.id });
  assert.equal(completed.version, 1);
  const origin = completed.snapshot.attendanceOrigin!;
  assert.equal(origin.confirmedBy!.id, admin.id);
  assert.equal(origin.confirmedAt, "2076-02-15T13:10:00.000Z");
  assert.equal(origin.priorState, false);
  const history = await overdue.classRecords.history({ sessionId: fixtureData.session.id });
  assert.equal(history.items[0]!.authorId, teacher.id);
  assert.equal(history.items[0]!.recordedAt.toISOString(), "2076-02-16T14:00:00.000Z");
  assert.deepEqual(
    completed.snapshot.entries.map((row) => row.status),
    ["PRESENT", "PRESENT"],
  );
  const result = await caller("2076-02-16T15:00:00Z").classRecords.save({
    ...correction,
    version: 1,
    attendanceStamp: completed.attendanceStamp,
  });
  assert.equal(result.version, 2);
  const corrected = await caller().classRecords.detail({ sessionId: fixtureData.session.id });
  assert.deepEqual(
    corrected.snapshot.entries.map((row) => row.status),
    ["ABSENT", "PRESENT"],
  );
});
