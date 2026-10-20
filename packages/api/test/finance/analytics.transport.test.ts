import assert from "node:assert/strict";
import { it } from "node:test";
import { ADMIN, callHttpQuery } from "../support/finance-test-support.js";

type ErrorPayload = { error: { json: { data: { code: string } } } };

void it("keeps cash and charge aggregates private to administrators", async () => {
  for (const role of ["TEACHER", "FINANCE", "SECRETARY"] as const) {
    const response = await callHttpQuery({
      path: "finance.analytics",
      body: { year: 2026 },
      staffUser: { ...ADMIN, role },
    });
    assert.equal(response.status, 403, role);
    assert.equal(((await response.json()) as ErrorPayload).error.json.data.code, "FORBIDDEN");
  }
  const guest = await callHttpQuery({
    path: "finance.analytics",
    body: { year: 2026 },
    staffUser: null,
  });
  assert.equal(guest.status, 401);
  assert.equal(((await guest.json()) as ErrorPayload).error.json.data.code, "UNAUTHORIZED");
});

void it("rejects unbounded or fractional reporting years before querying", async () => {
  for (const year of [1999, 2101, 2026.5, "2026"]) {
    const response = await callHttpQuery({ path: "finance.analytics", body: { year } });
    assert.equal(response.status, 400, String(year));
    assert.equal(((await response.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
  }
});

void it("rejects client-controlled cutoffs and roles", async () => {
  const response = await callHttpQuery({
    path: "finance.analytics",
    body: { year: 2026, asOf: "2099-01-01", role: "ADMIN" },
  });
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as ErrorPayload).error.json.data.code, "BAD_REQUEST");
});
