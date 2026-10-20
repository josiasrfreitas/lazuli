import assert from "node:assert/strict";
import { it } from "node:test";
import { ADMIN, callHttpQuery } from "../support/finance-test-support.js";

void it("keeps contract projections private to administrators", async () => {
  for (const role of ["TEACHER", "FINANCE", "SECRETARY"] as const) {
    const response = await callHttpQuery({
      path: "finance.contractClosings",
      body: { year: 2026 },
      staffUser: { ...ADMIN, role },
    });
    assert.equal(response.status, 403, role);
  }
  const guest = await callHttpQuery({
    path: "finance.contractClosings",
    body: { year: 2026 },
    staffUser: null,
  });
  assert.equal(guest.status, 401);
});

void it("rejects unbounded or fractional reporting years before querying", async () => {
  for (const year of [1999, 2101, 2026.5, "2026"]) {
    const response = await callHttpQuery({ path: "finance.contractClosings", body: { year } });
    assert.equal(response.status, 400, String(year));
  }
});
