import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { ADMIN, callHttpQuery, ensureAdminUser } from "../support/finance-test-support.js";
import {
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";

type ErrorPayload = { error: { json: { data: { code: string } } } };

void it("keeps student financial summaries administrative and rejects extra fields before reading", async () => {
  for (const scenario of [
    { staffUser: null, status: 401, code: "UNAUTHORIZED" },
    { staffUser: { ...ADMIN, role: "TEACHER" as const }, status: 403, code: "FORBIDDEN" },
  ]) {
    const response = await callHttpQuery({
      path: "finance.studentSummary",
      body: { studentId: crypto.randomUUID() },
      staffUser: scenario.staffUser,
    });
    assert.equal(response.status, scenario.status);
    assert.equal(((await response.json()) as ErrorPayload).error.json.data.code, scenario.code);
  }
  const invalid = await callHttpQuery({
    path: "finance.studentSummary",
    body: { studentId: "not-a-uuid" },
  });
  assert.equal(invalid.status, 400);
  assert.equal(((await invalid.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
  const extra = await callHttpQuery({
    path: "finance.studentSummary",
    body: { studentId: crypto.randomUUID(), now: "2099-01-01" },
  });
  assert.equal(extra.status, 400);
  assert.equal(((await extra.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
});

void it("serializes the student's own summary and rejects a removed student", async () => {
  await ensureAdminUser();
  try {
    const fixture = await createInstallmentOrder({ dueDate: "2026-04-10" });
    const studentId = fixture.studentIds[0];
    assert.ok(studentId);
    const response = await callHttpQuery({
      path: "finance.studentSummary",
      body: { studentId },
      now: new Date("2026-03-01T02:59:59Z"),
    });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      result: { data: { json: { asOf: string; outstandingCents: number; nextDueDate: string } } };
    };
    assert.equal(payload.result.data.json.asOf, "2026-02-28");
    assert.equal(payload.result.data.json.outstandingCents, 10_000);
    assert.equal(payload.result.data.json.nextDueDate, "2026-04-10");
    await db.student.update({ where: { id: studentId }, data: { deletedAt: new Date() } });
    const removed = await callHttpQuery({ path: "finance.studentSummary", body: { studentId } });
    assert.equal(removed.status, 404);
    assert.equal(((await removed.json()) as ErrorPayload).error.json.data.code, "NOT_FOUND");
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});
