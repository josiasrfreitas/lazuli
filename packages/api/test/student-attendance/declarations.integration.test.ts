import assert from "node:assert/strict";
import { beforeEach, after, it } from "node:test";
import { db } from "@lazuli/db";
import {
  cleanDeclarations,
  declarationFixture,
  declarationCaller,
  declarationTeacher,
  declarationAdmin,
} from "../support/student-attendance.js";
const now = "2077-03-10T12:05:00Z";
const browserId = "00000000-0000-4000-8000-000000001821";
const location = { latitude: -9.6, longitude: -35.75, accuracy: 18, capturedAt: now };
beforeEach(cleanDeclarations);
after(async () => {
  await cleanDeclarations();
  await db.$disconnect();
});
void it("keeps a student's receipt separate from final attendance and preserves it under concurrent retries", async () => {
  const fixture = await declarationFixture();
  const person = fixture.students[0]!;
  const window = await declarationCaller(now, declarationTeacher).studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 10,
    location,
  });
  const publicCaller = declarationCaller(now, null);
  const input = {
    token: window.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
    browserId,
    location,
  };
  await assert.rejects(
    publicCaller.studentAttendance.submit({ ...input, location: null }),
    /Compartilhe sua localização/u,
  );
  const matches = await publicCaller.studentAttendance.search({
    token: window.token,
    name: person.name,
  });
  assert.equal(matches.exactId, person.enrollmentId);
  const receipts = await Promise.all([
    publicCaller.studentAttendance.submit(input),
    publicCaller.studentAttendance.submit(input),
  ]);
  assert.deepEqual(
    receipts.map((receipt) => receipt.submittedAt.toISOString()),
    ["2077-03-10T12:05:00.000Z", "2077-03-10T12:05:00.000Z"],
  );
  assert.deepEqual(receipts.map((receipt) => receipt.repeated).toSorted(), [false, true]);
  assert.equal(
    await db.attendanceDeclaration.count({ where: { classSessionId: fixture.session.id } }),
    1,
  );
  assert.equal(await db.attendance.count({ where: { classSessionId: fixture.session.id } }), 0);
  const unconfirmed = await db.classSession.findUniqueOrThrow({
    where: { id: fixture.session.id },
  });
  assert.equal(unconfirmed.attendanceConfirmedAt, null);
  const content = {
    kind: "REVIEW" as const,
    account: "Retomamos a conversa sobre rotinas.",
    reference: null,
    pageFrom: null,
    pageTo: null,
  };
  const detail = await declarationCaller().classRecords.detail({ sessionId: fixture.session.id });
  const recordInput = {
    qrReviewed: true,
    sessionId: fixture.session.id,
    version: 0,
    attendanceStamp: null,
    declarationIds: detail.declarations.map((entry) => entry.id),
    note: null,
    sharedContent: content,
    rows: fixture.students.map((row, index) => ({
      enrollmentId: row.enrollmentId,
      status: index === 0 ? ("ABSENT" as const) : ("PRESENT" as const),
      content: null,
    })),
  };
  await assert.rejects(
    declarationCaller("2077-03-10T13:00:00Z", declarationTeacher).classRecords.save({
      ...recordInput,
      qrReviewed: false,
    }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    declarationCaller("2077-03-10T13:00:00Z", declarationTeacher).classRecords.save({
      ...recordInput,
      declarationIds: [],
    }),
    { code: "CONFLICT" },
  );
  assert.equal(await db.attendance.count({ where: { classSessionId: fixture.session.id } }), 0);
  const stillOpen = await db.attendanceWindow.findUniqueOrThrow({ where: { id: window.id } });
  assert.equal(stillOpen.closedAt, null);
  await declarationCaller("2077-03-10T13:00:00Z", declarationTeacher).classRecords.save(
    recordInput,
  );
  const final = await db.attendance.findFirstOrThrow({
    where: { classSessionId: fixture.session.id, enrollmentId: person.enrollmentId },
  });
  assert.equal(final.status, "ABSENT");
  assert.equal(final.recordedById, declarationTeacher.id);
  const closed = await db.attendanceWindow.findUniqueOrThrow({ where: { id: window.id } });
  assert.equal(closed.closedAt?.toISOString(), "2077-03-10T13:00:00.000Z");
  assert.equal(closed.closedById, declarationTeacher.id);
  // Even a delayed request carrying an earlier clock cannot bypass the now-confirmed call.
  await assert.rejects(publicCaller.studentAttendance.submit(input), /encerrado ou venceu/u);
});
void it("rotates capability links, enforces expiry and never accepts an off-roster identity or stale location", async () => {
  const fixture = await declarationFixture();
  const first = await declarationCaller().studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 10,
    location: null,
  });
  const second = await declarationCaller("2077-03-10T12:06:00Z").studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 10,
    location: null,
  });
  await assert.rejects(
    declarationCaller("2077-03-10T12:06:00Z", null).studentAttendance.inspect({
      token: first.token,
    }),
    /encerrado ou venceu/u,
  );
  const existing = await db.attendanceWindow.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(existing.closedAt?.toISOString(), "2077-03-10T12:06:00.000Z");
  assert.notEqual(existing.tokenHash, first.token);
  const person = fixture.students[0]!;
  const input = {
    token: second.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
    browserId,
    location,
  };
  await assert.rejects(
    declarationCaller("2077-03-10T12:06:00Z", null).studentAttendance.submit({
      ...input,
      enrollmentId: declarationAdmin.id,
    }),
    /Confira o nome/u,
  );
  await assert.rejects(
    declarationCaller("2077-03-10T12:08:00Z", null).studentAttendance.submit(input),
    /Atualize a localização/u,
  );
  await assert.rejects(
    declarationCaller("2077-03-10T12:16:00Z", null).studentAttendance.submit(input),
    /encerrado ou venceu/u,
  );
  assert.equal(
    await db.attendanceDeclaration.count({ where: { classSessionId: fixture.session.id } }),
    0,
  );
  await declarationCaller("2077-03-10T12:07:00Z").studentAttendance.close({
    sessionId: fixture.session.id,
  });
  await assert.rejects(
    declarationCaller("2077-03-10T12:08:00Z", null).studentAttendance.inspect({
      token: second.token,
    }),
    /encerrado ou venceu/u,
  );
});
void it("authorizes the dated teacher and administrative roles within the encounter window, including a substitute", async () => {
  const fixture = await declarationFixture();
  await assert.rejects(
    declarationCaller("2077-03-09T12:05:00Z").studentAttendance.open({
      sessionId: fixture.session.id,
      minutes: 10,
      location: null,
    }),
    /no dia da aula/u,
  );
  await assert.rejects(
    declarationCaller("2077-03-10T11:29:00Z").studentAttendance.open({
      sessionId: fixture.session.id,
      minutes: 10,
      location: null,
    }),
    /30 minutos/u,
  );
  await assert.rejects(
    declarationCaller(now, null).studentAttendance.open({
      sessionId: fixture.session.id,
      minutes: 10,
      location: null,
    }),
    { code: "UNAUTHORIZED" },
  );
  await assert.rejects(
    declarationCaller(now, { ...declarationAdmin, role: "FINANCE" }).studentAttendance.status({
      sessionId: fixture.session.id,
    }),
    { code: "FORBIDDEN" },
  );
  const other = await db.user.create({
    data: {
      name: "Substituta V5",
      email: "substitute182@example.com",
      role: "TEACHER",
      isEnabled: true,
    },
  });
  try {
    const teacher = {
      id: other.id,
      name: other.name,
      email: other.email,
      role: "TEACHER" as const,
      isEnabled: true,
    };
    await assert.rejects(
      declarationCaller(now, teacher).studentAttendance.status({ sessionId: fixture.session.id }),
      { code: "FORBIDDEN" },
    );
    await db.classSubstitution.create({
      data: {
        classId: fixture.group.id,
        classSessionId: fixture.session.id,
        date: fixture.session.date,
        teacherId: teacher.id,
        recordedById: declarationAdmin.id,
      },
    });
    await assert.rejects(
      declarationCaller(now, declarationTeacher).studentAttendance.open({
        sessionId: fixture.session.id,
        minutes: 10,
        location: null,
      }),
      { code: "FORBIDDEN" },
    );
    const opened = await declarationCaller("2077-03-10T12:55:00Z", teacher).studentAttendance.open({
      sessionId: fixture.session.id,
      minutes: 30,
      location: null,
    });
    assert.equal(opened.expiresAt.toISOString(), "2077-03-10T13:00:00.000Z");
    const attributed = await db.attendanceWindow.findUniqueOrThrow({ where: { id: opened.id } });
    assert.equal(attributed.openedById, other.id);
    await db.classSession.update({
      where: { id: fixture.session.id },
      data: {
        status: "CANCELLED",
        cancelReason: "Encerramento extraordinário",
        cancelledAt: new Date("2077-03-10T12:56:00Z"),
        cancelledById: declarationAdmin.id,
      },
    });
    await assert.rejects(
      declarationCaller("2077-03-10T12:56:00Z", null).studentAttendance.inspect({
        token: opened.token,
      }),
      /encerrado ou venceu/u,
    );
  } finally {
    await cleanDeclarations();
    await db.user.delete({ where: { id: other.id } });
  }
});
void it("accepts online declarations without location and requires an explicit distinguishable homonym selection", async () => {
  const fixture = await declarationFixture(true);
  const sharedName = "Declare182 Ana Silva";
  await db.student.update({
    where: { id: fixture.students[1]!.studentId },
    data: { fullName: sharedName },
  });
  const window = await declarationCaller().studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 20,
    location: null,
  });
  const anonymous = declarationCaller(now, null);
  let matches = await anonymous.studentAttendance.search({ token: window.token, name: sharedName });
  assert.equal(matches.exactId, null);
  assert.deepEqual(
    matches.options.map((row) => row.manualRequired),
    [true, true],
  );
  await assert.rejects(
    anonymous.studentAttendance.submit({
      token: window.token,
      name: sharedName,
      enrollmentId: fixture.students[0]!.enrollmentId,
      browserId,
      location: null,
    }),
    /Confira o nome/u,
  );
  await db.student.update({
    where: { id: fixture.students[0]!.studentId },
    data: { phone: "82999991234" },
  });
  await db.student.update({
    where: { id: fixture.students[1]!.studentId },
    data: { phone: "82999995678" },
  });
  matches = await anonymous.studentAttendance.search({ token: window.token, name: sharedName });
  assert.equal(matches.exactId, null);
  assert.deepEqual(matches.options.map((row) => row.phoneHint).toSorted(), ["1234", "5678"]);
  await assert.rejects(
    anonymous.studentAttendance.submit({
      token: window.token,
      name: sharedName,
      enrollmentId: fixture.students[0]!.enrollmentId,
      browserId,
      location,
    }),
    /não utilizam localização/u,
  );
  await anonymous.studentAttendance.submit({
    token: window.token,
    name: sharedName,
    enrollmentId: fixture.students[1]!.enrollmentId,
    browserId,
    location: null,
  });
  const saved = await db.attendanceDeclaration.findFirstOrThrow({
    where: { classSessionId: fixture.session.id },
  });
  assert.equal(saved.enrollmentId, fixture.students[1]!.enrollmentId);
  assert.equal(saved.matchKind, "SELECTED");
  assert.deepEqual(
    [saved.latitude, saved.longitude, saved.accuracy, saved.capturedAt],
    [null, null, null, null],
  );
});

void it("keeps the browser limit across renewals without consuming failed choices, and revokes projection on closure", async () => {
  const fixture = await declarationFixture(true);
  let caller = declarationCaller(now, null);
  const first = await declarationCaller().studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 10,
    location: null,
  });
  const person = fixture.students[0]!;
  const input = {
    token: first.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
    location: null,
    browserId,
  };
  const receipt = await caller.studentAttendance.submit(input);
  const renewed = await declarationCaller("2077-03-10T12:06:00Z").studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 20,
    location: null,
    projectionToken: first.projectionToken,
  });
  caller = declarationCaller("2077-03-10T12:06:00Z", null);
  assert.equal(renewed.projectionToken, first.projectionToken);
  const projection = await declarationCaller(
    "2077-03-10T12:06:00Z",
    null,
  ).studentAttendance.projection({ token: first.projectionToken });
  assert.equal(projection.token, renewed.token);
  assert.deepEqual(Object.keys(projection).toSorted(), ["expiresAt", "token"]);
  const stored = await db.attendanceProjection.findUniqueOrThrow({
    where: { classSessionId: fixture.session.id },
  });
  assert.notEqual(stored.tokenHash, renewed.projectionToken);
  assert.equal(JSON.stringify(stored).includes(renewed.token), false);
  const retry = await caller.studentAttendance.submit({ ...input, token: renewed.token });
  assert.equal(retry.submittedAt.toISOString(), "2077-03-10T12:05:00.000Z");
  assert.equal(retry.repeated, true);
  const other = fixture.students[1]!;
  await assert.rejects(
    caller.studentAttendance.submit({
      ...input,
      token: renewed.token,
      name: other.name,
      enrollmentId: other.enrollmentId,
    }),
    /navegador já confirmou/u,
  );
  const anotherBrowser = "00000000-0000-4000-8000-000000001823";
  await assert.rejects(
    caller.studentAttendance.submit({ ...input, token: renewed.token, browserId: anotherBrowser }),
    /tentativa não consumiu/u,
  );
  await caller.studentAttendance.submit({
    ...input,
    token: renewed.token,
    browserId: anotherBrowser,
    name: other.name,
    enrollmentId: other.enrollmentId,
  });
  assert.equal(
    await db.attendanceDeclaration.count({ where: { classSessionId: fixture.session.id } }),
    2,
  );
  await declarationCaller("2077-03-10T12:07:00Z").studentAttendance.close({
    sessionId: fixture.session.id,
  });
  const closedProjection = await caller.studentAttendance.projection({
    token: first.projectionToken,
  });
  assert.equal(closedProjection.token, null);
  const historical = await declarationCaller(
    "2077-03-10T13:30:00Z",
    null,
  ).studentAttendance.receipt({ token: first.token, browserId });
  assert.deepEqual(historical, { name: person.name, submittedAt: receipt.submittedAt });
});
void it("blocks presential sending without explicit campus criteria, outside the area or without adequate precision", async () => {
  const fixture = await declarationFixture();
  await db.attendanceSettings.delete({ where: { key: "school" } });
  await assert.rejects(
    declarationCaller().studentAttendance.open({
      sessionId: fixture.session.id,
      minutes: 5,
      location: null,
    }),
    /configurar a localização/u,
  );
  await declarationCaller().studentAttendance.saveSettings({
    latitude: -9.6,
    longitude: -35.75,
    radiusMeters: 100,
    maxAccuracyMeters: 50,
  });
  const opened = await declarationCaller().studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 5,
    location: null,
  });
  assert.equal(opened.expiresAt.toISOString(), "2077-03-10T12:10:00.000Z");
  const person = fixture.students[0]!;
  const input = {
    token: opened.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
    browserId,
    location,
  };
  const caller = declarationCaller(now, null);
  await assert.rejects(
    caller.studentAttendance.submit({ ...input, location: { ...location, longitude: -35.76 } }),
    /fora da área/u,
  );
  await assert.rejects(
    caller.studentAttendance.submit({ ...input, location: { ...location, accuracy: 51 } }),
    /precisão suficiente/u,
  );
  // Criteria are frozen for the opened window; a configuration edit only affects future links.
  await declarationCaller().studentAttendance.saveSettings({
    latitude: -8,
    longitude: -34,
    radiusMeters: 10,
    maxAccuracyMeters: 5,
  });
  const receipt = await caller.studentAttendance.submit(input);
  assert.equal(receipt.name, person.name);
  const stored = await db.attendanceDeclaration.findFirstOrThrow({
    where: { classSessionId: fixture.session.id },
  });
  assert.equal(stored.latitude, -9.6);
  assert.equal(stored.accuracy, 18);
  await assert.rejects(
    declarationCaller().attendance.confirmSession({
      sessionId: fixture.session.id,
      rows: fixture.students.map((row) => ({
        enrollmentId: row.enrollmentId,
        status: "PRESENT" as const,
      })),
    }),
    /registro da aula/u,
  );
});
