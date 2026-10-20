import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { db } from "@lazuli/db";
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
