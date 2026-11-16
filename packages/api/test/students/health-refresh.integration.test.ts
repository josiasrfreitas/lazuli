import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { createCaller } from "@lazuli/api";
import { ADMIN, TEACHER } from "../support/calendar-test-support.js";

void it("enqueues only the selected student for the authenticated administrator and scopes run status", async () => {
  const selected = await db.student.create({ data: { fullName: "Health refresh selected" } });
  const other = await db.student.create({ data: { fullName: "Health refresh untouched" } });
  const runId = randomUUID();
  const enqueued: { studentId: string; actorId: string }[] = [];
  const observed: { runId: string; studentId: string; actorId: string }[] = [];
  const caller = createCaller({
    db,
    staffUser: ADMIN,
    studentHealthRefreshQueue: {
      enqueue: (studentId, actorId) => {
        enqueued.push({ studentId, actorId });
        return Promise.resolve(runId);
      },
      status: (input) => {
        observed.push(input);
        return Promise.resolve("COMPLETED");
      },
    },
  });
  try {
    assert.deepEqual(await caller.students.refreshHealth({ id: selected.id }), { runId });
    assert.deepEqual(enqueued, [{ studentId: selected.id, actorId: ADMIN.id }]);
    assert.deepEqual(await caller.students.healthRefreshStatus({ id: selected.id, runId }), {
      status: "COMPLETED",
    });
    assert.deepEqual(observed, [{ runId, studentId: selected.id, actorId: ADMIN.id }]);
    await assert.rejects(
      caller.students.refreshHealth({ id: randomUUID() }),
      /Aluno não encontrado/u,
    );
    assert.equal(enqueued.length, 1);
    await assert.rejects(
      createCaller({ db, staffUser: TEACHER }).students.refreshHealth({ id: selected.id }),
      { code: "FORBIDDEN" },
    );
  } finally {
    await db.studentHealthPending.deleteMany({
      where: { studentId: { in: [selected.id, other.id] } },
    });
    await db.student.deleteMany({ where: { id: { in: [selected.id, other.id] } } });
    await db.$disconnect();
  }
});
