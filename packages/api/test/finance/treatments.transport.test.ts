import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import {
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";
import {
  ensureAdminUser,
  ADMIN,
  callHttpMutation,
  callHttpQuery,
} from "../support/finance-test-support.js";
type ErrorPayload = { error: { json: { data: { code: string } } } };
void it("keeps every treatment endpoint administrative and rejects client-supplied authority or dates", async () => {
  const id = crypto.randomUUID();
  for (const scenario of [
    { staffUser: null, status: 401, code: "UNAUTHORIZED" },
    { staffUser: { ...ADMIN, role: "TEACHER" as const }, status: 403, code: "FORBIDDEN" },
  ]) {
    for (const path of [
      "finance.treatmentInstallments",
      "finance.previewTreatment",
      "finance.treatmentHistory",
    ]) {
      const response = await callHttpQuery({
        path,
        body: { studentId: id },
        staffUser: scenario.staffUser,
      });
      assert.equal(response.status, scenario.status, path);
      assert.equal(
        ((await response.json()) as ErrorPayload).error.json.data.code,
        scenario.code,
        path,
      );
    }
    const write = await callHttpMutation({
      path: "finance.confirmTreatment",
      body: {},
      staffUser: scenario.staffUser,
    });
    assert.equal(write.status, scenario.status);
    assert.equal(((await write.json()) as ErrorPayload).error.json.data.code, scenario.code);
  }
  const foreign = await callHttpMutation({
    path: "finance.confirmTreatment",
    body: {
      rows: [{ installmentId: id, reductionCents: 1 }],
      reason: "Prazo combinado",
      commandId: crypto.randomUUID(),
      version: "stale",
      actorName: "Outro administrador",
    },
  });
  assert.equal(foreign.status, 400);
  assert.equal(((await foreign.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
  const invalid = await callHttpQuery({
    path: "finance.previewTreatment",
    body: { rows: [{ installmentId: id, reductionCents: 1 }], newDueDate: "2026-02-30" },
  });
  assert.equal(invalid.status, 400);
  assert.equal(((await invalid.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
});

void it("accepts the infinite-query wire direction and exposes both pages while retaining strict validation", async () => {
  await ensureAdminUser();
  try {
    const fixture = await createInstallmentOrder({ installmentCount: 51, dueDate: "2026-01-31" });
    const studentId = fixture.studentIds[0];
    assert.ok(studentId);
    const first = await callHttpQuery({
      path: "finance.treatmentInstallments",
      body: { studentId, direction: "forward" },
      now: new Date("2026-02-10T12:00:00Z"),
    });
    assert.equal(first.status, 200);
    const payload = (await first.json()) as {
      result: { data: { json: { rows: { id: string }[]; nextCursor: number | null } } };
    };
    assert.equal(payload.result.data.json.rows.length, 50);
    assert.equal(payload.result.data.json.nextCursor, 2);
    const second = await callHttpQuery({
      path: "finance.treatmentInstallments",
      body: { studentId, direction: "forward", cursor: 2 },
      now: new Date("2026-02-10T12:00:00Z"),
    });
    assert.equal(second.status, 200);
    const tail = (await second.json()) as typeof payload;
    assert.equal(tail.result.data.json.rows.length, 1);
    assert.equal(tail.result.data.json.nextCursor, null);
    assert.equal(
      payload.result.data.json.rows.some((row) => row.id === tail.result.data.json.rows[0]?.id),
      false,
    );
    const invalid = await callHttpQuery({
      path: "finance.treatmentInstallments",
      body: { studentId, direction: "backward" },
    });
    assert.equal(invalid.status, 400);
    assert.equal(((await invalid.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});
