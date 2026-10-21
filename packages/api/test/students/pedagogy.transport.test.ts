import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { db } from "@lazuli/db";
import type { RouterOutputs } from "@lazuli/api";
import { ADMIN, callHttpQuery } from "../support/finance-test-support.js";

void it("protects the learning profile over HTTP and serializes the authorized empty state", async () => {
  const id = randomUUID();
  try {
    await db.student.create({ data: { id, fullName: "Profile HTTP fixture" } });
    const guest = await callHttpQuery({ path: "students.pedagogy", body: { id }, staffUser: null });
    assert.equal(guest.status, 401);
    const teacher = await callHttpQuery({
      path: "students.pedagogy",
      body: { id },
      staffUser: { ...ADMIN, role: "TEACHER" },
    });
    assert.equal(teacher.status, 403);
    const invalid = await callHttpQuery({ path: "students.pedagogy", body: { id: "invalid" } });
    assert.equal(invalid.status, 400);
    const missing = await callHttpQuery({ path: "students.pedagogy", body: { id: randomUUID() } });
    assert.equal(missing.status, 404);
    const admin = await callHttpQuery({
      path: "students.pedagogy",
      body: { id },
      now: new Date("2044-04-15T02:30:00Z"),
    });
    assert.equal(admin.status, 200);
    const result = (await admin.json()) as {
      result: { data: { json: { today: string; enrollments: { id: string }[] } } };
    };
    assert.deepEqual(result.result.data.json, { today: "2044-04-14", enrollments: [] });
    const system = await callHttpQuery({
      path: "students.pedagogy",
      body: { id },
      staffUser: { ...ADMIN, role: "SYSTEM_ADMIN" },
    });
    assert.equal(system.status, 200);
    await db.student.update({ where: { id }, data: { deletedAt: new Date() } });
    const removed = await callHttpQuery({ path: "students.pedagogy", body: { id } });
    assert.equal(removed.status, 404);
  } finally {
    await db.student.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});

void it("keeps attendance history administrative over HTTP and serializes an empty historical window without inventing frequency", async () => {
  const id = randomUUID();
  try {
    await db.student.create({ data: { id, fullName: "History HTTP fixture" } });
    const guest = await callHttpQuery({
      path: "students.attendanceHistory",
      body: { id },
      staffUser: null,
    });
    assert.equal(guest.status, 401);
    const unauthorized = (await guest.json()) as { error: { json: { data: { code: string } } } };
    assert.equal(unauthorized.error.json.data.code, "UNAUTHORIZED");
    const teacher = await callHttpQuery({
      path: "students.attendanceHistory",
      body: { id },
      staffUser: { ...ADMIN, role: "TEACHER" },
    });
    assert.equal(teacher.status, 403);
    const forbidden = (await teacher.json()) as { error: { json: { data: { code: string } } } };
    assert.equal(forbidden.error.json.data.code, "FORBIDDEN");
    const admin = await callHttpQuery({
      path: "students.attendanceHistory",
      body: { id },
      now: new Date("2044-04-15T02:30:00Z"),
    });
    assert.equal(admin.status, 200);
    const result = (await admin.json()) as {
      result: { data: { json: RouterOutputs["students"]["attendanceHistory"] } };
    };
    assert.deepEqual(result.result.data.json, {
      today: "2044-04-14",
      enrollments: [],
      rows: [],
      attendance: {
        heldSessions: 0,
        presentCount: 0,
        heldMinutes: 0,
        presentMinutes: 0,
        compensatedMinutes: 0,
        missingMinutes: 0,
        percent: null,
        flagged: false,
      },
      counts: { ALL: 0, PRESENT: 0, ABSENT: 0, PENDING: 0, CANCELLED: 0 },
      page: 1,
      pageSize: 25,
      pageCount: 1,
      totalItems: 0,
    });
  } finally {
    await db.student.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
