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
const location = { latitude: -9.6, longitude: -35.75, accuracy: 18, capturedAt: now };
beforeEach(cleanDeclarations);
after(async () => {
  await cleanDeclarations();
  await db.$disconnect();
});
void it("keeps a student's receipt separate from final attendance and preserves it under concurrent retries", async () => {
  const f = await declarationFixture();
  const person = f.students[0]!;
  const window = await declarationCaller(now, declarationTeacher).studentAttendance.open({
    sessionId: f.session.id,
    minutes: 10,
    location,
  });
  const publicCaller = declarationCaller(now, null);
  const input = {
    token: window.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
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
  assert.deepEqual(receipts.map((receipt) => receipt.repeated).sort(), [false, true]);
  assert.equal(
    await db.attendanceDeclaration.count({ where: { classSessionId: f.session.id } }),
    1,
  );
  assert.equal(await db.attendance.count({ where: { classSessionId: f.session.id } }), 0);
  assert.equal(
    (await db.classSession.findUniqueOrThrow({ where: { id: f.session.id } }))
      .attendanceConfirmedAt,
    null,
  );
  const content = {
    kind: "REVIEW" as const,
    account: "Retomamos a conversa sobre rotinas.",
    reference: null,
    pageFrom: null,
    pageTo: null,
  };
  await declarationCaller("2077-03-10T13:00:00Z", declarationTeacher).classRecords.save({
    sessionId: f.session.id,
    version: 0,
    attendanceStamp: null,
    note: null,
    sharedContent: content,
    rows: f.students.map((row, index) => ({
      enrollmentId: row.enrollmentId,
      status: index === 0 ? "ABSENT" : "PRESENT",
      content: null,
    })),
  });
  const final = await db.attendance.findFirstOrThrow({
    where: { classSessionId: f.session.id, enrollmentId: person.enrollmentId },
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
  const f = await declarationFixture();
  const first = await declarationCaller().studentAttendance.open({
    sessionId: f.session.id,
    minutes: 10,
    location: null,
  });
  const second = await declarationCaller("2077-03-10T12:06:00Z").studentAttendance.open({
    sessionId: f.session.id,
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
  const person = f.students[0]!;
  const input = {
    token: second.token,
    name: person.name,
    enrollmentId: person.enrollmentId,
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
    await db.attendanceDeclaration.count({ where: { classSessionId: f.session.id } }),
    0,
  );
  await declarationCaller("2077-03-10T12:07:00Z").studentAttendance.close({
    sessionId: f.session.id,
  });
  await assert.rejects(
    declarationCaller("2077-03-10T12:08:00Z", null).studentAttendance.inspect({
      token: second.token,
    }),
    /encerrado ou venceu/u,
  );
});
void it("authorizes the dated teacher and administrative roles within the encounter window, including a substitute", async () => {
  const f = await declarationFixture();
  await assert.rejects(
    declarationCaller("2077-03-09T12:05:00Z").studentAttendance.open({
      sessionId: f.session.id,
      minutes: 10,
      location: null,
    }),
    /no dia da aula/u,
  );
  await assert.rejects(
    declarationCaller("2077-03-10T11:29:00Z").studentAttendance.open({
      sessionId: f.session.id,
      minutes: 10,
      location: null,
    }),
    /30 minutos/u,
  );
  await assert.rejects(
    declarationCaller(now, null).studentAttendance.open({
      sessionId: f.session.id,
      minutes: 10,
      location: null,
    }),
    { code: "UNAUTHORIZED" },
  );
  await assert.rejects(
    declarationCaller(now, { ...declarationAdmin, role: "FINANCE" }).studentAttendance.status({
      sessionId: f.session.id,
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
      declarationCaller(now, teacher).studentAttendance.status({ sessionId: f.session.id }),
      { code: "FORBIDDEN" },
    );
    await db.classSubstitution.create({
      data: {
        classId: f.group.id,
        classSessionId: f.session.id,
        date: f.session.date,
        teacherId: teacher.id,
        recordedById: declarationAdmin.id,
      },
    });
    await assert.rejects(
      declarationCaller(now, declarationTeacher).studentAttendance.open({
        sessionId: f.session.id,
        minutes: 10,
        location: null,
      }),
      { code: "FORBIDDEN" },
    );
    const opened = await declarationCaller("2077-03-10T12:55:00Z", teacher).studentAttendance.open({
      sessionId: f.session.id,
      minutes: 30,
      location: null,
    });
    assert.equal(opened.expiresAt.toISOString(), "2077-03-10T13:00:00.000Z");
    assert.equal(
      (await db.attendanceWindow.findUniqueOrThrow({ where: { id: opened.id } })).openedById,
      other.id,
    );
    await db.classSession.update({
      where: { id: f.session.id },
      data: { status: "CANCELLED", cancelReason: "Encerramento extraordinário" },
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
  const f = await declarationFixture(true);
  const sharedName = "Declare182 Ana Silva";
  await db.student.update({
    where: { id: f.students[1]!.studentId },
    data: { fullName: sharedName },
  });
  const window = await declarationCaller().studentAttendance.open({
    sessionId: f.session.id,
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
      enrollmentId: f.students[0]!.enrollmentId,
      location: null,
    }),
    /Confira o nome/u,
  );
  await db.student.update({
    where: { id: f.students[0]!.studentId },
    data: { phone: "82999991234" },
  });
  await db.student.update({
    where: { id: f.students[1]!.studentId },
    data: { phone: "82999995678" },
  });
  matches = await anonymous.studentAttendance.search({ token: window.token, name: sharedName });
  assert.equal(matches.exactId, null);
  assert.deepEqual(matches.options.map((row) => row.phoneHint).sort(), ["1234", "5678"]);
  await assert.rejects(
    anonymous.studentAttendance.submit({
      token: window.token,
      name: sharedName,
      enrollmentId: f.students[0]!.enrollmentId,
      location,
    }),
    /não utilizam localização/u,
  );
  await anonymous.studentAttendance.submit({
    token: window.token,
    name: sharedName,
    enrollmentId: f.students[1]!.enrollmentId,
    location: null,
  });
  const saved = await db.attendanceDeclaration.findFirstOrThrow({
    where: { classSessionId: f.session.id },
  });
  assert.equal(saved.enrollmentId, f.students[1]!.enrollmentId);
  assert.equal(saved.matchKind, "SELECTED");
  assert.deepEqual(
    [saved.latitude, saved.longitude, saved.accuracy, saved.capturedAt],
    [null, null, null, null],
  );
});
