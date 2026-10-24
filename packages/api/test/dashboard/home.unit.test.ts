import assert from "node:assert/strict";
import { it } from "node:test";
import { endedWhere, plusDays } from "../../src/dashboard/home-model.js";
import { caller, TEACHER, ADMIN } from "../support/dashboard-test-support.js";

void it("uses the previous school date before midnight in São Paulo", () => {
  assert.deepEqual(endedWhere(new Date("2026-11-01T02:30:00Z")), {
    OR: [
      { date: { lt: new Date("2026-10-31") } },
      { date: new Date("2026-10-31"), endTime: { lte: new Date("1970-01-01T23:30:00Z") } },
    ],
  });
  assert.equal(plusDays("2026-12-29", 6), "2027-01-04");
});
void it("denies administrative home, pending cases and business metrics to teachers", async () => {
  const teacher = caller(TEACHER);
  await assert.rejects(teacher.dashboard.home(), { code: "FORBIDDEN" });
  await assert.rejects(teacher.dashboard.pending({ kind: "students", page: 1 }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(teacher.dashboard.business(), { code: "FORBIDDEN" });
});
void it("rejects invalid groups and pagination before querying persistence", async () => {
  const admin = caller(ADMIN);
  await assert.rejects(admin.dashboard.pending({ kind: "students", page: 0 }), {
    code: "BAD_REQUEST",
  });
  await assert.rejects(admin.dashboard.pending({ kind: "students", page: 1.5 }), {
    code: "BAD_REQUEST",
  });
});
