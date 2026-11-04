import assert from "node:assert/strict";
import { it } from "node:test";
import { financeInstallmentsInputSchema, financeInstallmentsOutputSchema } from "../src/finance.js";
const studentId = "00000000-0000-4000-8000-000000000001";
void it("accepts automatic and explicit filters only in an unambiguous student installment scope", () => {
  for (const studentFilter of ["auto", "all", "overdue", "paid"]) {
    assert.equal(
      financeInstallmentsInputSchema.safeParse({ studentId, studentFilter }).success,
      true,
    );
  }
  for (const values of [
    { studentFilter: "auto" },
    { studentId, studentFilter: "auto", view: "paid" },
    { studentId, studentFilter: "auto", statuses: ["PAID"] },
    { studentId, studentFilter: "invalid" },
  ])
    assert.equal(
      financeInstallmentsInputSchema.safeParse(values).success,
      false,
      JSON.stringify(values),
    );
});
void it("preserves the applied initial student filter through response validation", () => {
  const result = financeInstallmentsOutputSchema.parse({
    view: "all",
    studentFilter: "overdue",
    rows: [],
    page: 1,
    pageSize: 25,
    pageCount: 0,
    total: 0,
    counts: { all: 0, paid: 0, overdue: 0 },
  });
  assert.equal(result.view, "all");
  assert.ok("studentFilter" in result);
  assert.equal(result.studentFilter, "overdue");
});
