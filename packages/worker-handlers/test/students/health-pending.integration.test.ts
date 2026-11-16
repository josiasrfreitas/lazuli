import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { refreshStudentHealthPending } from "../../src/students/health-pending.js";

void it("manual refresh updates only its selected student", async () => {
  const selected = await db.student.create({ data: { fullName: "Health refresh selected" } });
  const other = await db.student.create({ data: { fullName: "Health refresh untouched" } });
  try {
    await refreshStudentHealthPending(db, selected.id);
    assert.equal(await db.studentHealthPending.count({ where: { studentId: selected.id } }), 1);
    assert.equal(await db.studentHealthPending.count({ where: { studentId: other.id } }), 0);
  } finally {
    await db.studentHealthPending.deleteMany({
      where: { studentId: { in: [selected.id, other.id] } },
    });
    await db.student.deleteMany({ where: { id: { in: [selected.id, other.id] } } });
    await db.$disconnect();
  }
});
