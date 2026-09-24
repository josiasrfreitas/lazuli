import assert from "node:assert/strict";
import { it } from "node:test";
import {
  FINANCE_INSTALLMENTS_PAGE_SIZE,
  financeInstallmentsInputSchema,
  financeInstallmentsOutputSchema,
  financeOverduePayerGroupSchema,
  financeInstallmentRowSchema,
  type FinanceOverduePayerGroup,
} from "../src/index.js";

void it("accepts overdue groups and rejects flat/group mixing or an incorrect page size", () => {
  assert.deepEqual(financeInstallmentsInputSchema.parse({ view: "overdue", search: " Ana " }), {
    view: "overdue",
    page: 1,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    search: "Ana",
  });
  const response = {
    view: "overdue",
    groups: [],
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 0,
    counts: { all: 0, paid: 0, overdue: 0 },
  };
  assert.deepEqual(financeInstallmentsOutputSchema.parse(response), response);
  for (const invalid of [
    { ...response, rows: [] },
    { ...response, pageSize: 99 },
    { ...response, view: "all", pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE, rows: [] },
    { ...response, view: "paid", pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE, rows: [] },
  ]) {
    assert.equal(financeInstallmentsOutputSchema.safeParse(invalid).success, false);
  }
});

void it("validates the overdue summary and its nested identities and installment rows", () => {
  const group = overdueGroupFixture();
  const {
    payer,
    beneficiaries: [beneficiary],
    rows: [row],
  } = group;
  assert.deepEqual(financeOverduePayerGroupSchema.parse(group), group);
  for (const invalid of [
    { ...group, installmentCount: 0 },
    { ...group, installmentCount: 1.5 },
    { ...group, collectibleBalanceCents: 0 },
    { ...group, collectibleBalanceCents: 1.5 },
    { ...group, maxOverdueDays: 0 },
    { ...group, maxOverdueDays: 1.5 },
    { ...group, unexpected: true },
    { ...group, payer: { ...payer, id: "invalid" } },
    { ...group, beneficiaries: [{ ...beneficiary, studentId: "invalid" }] },
    { ...group, rows: [{ ...row, installmentId: "invalid" }] },
    { ...group, rows: [{ ...row, origin: "CONTRACT" }] },
    { ...group, rows: [{ ...row, origin: undefined }] },
  ]) {
    assert.equal(financeOverduePayerGroupSchema.safeParse(invalid).success, false);
  }
});

void it("rejects non-collectible rows in the overdue response", () => {
  const group = overdueGroupFixture();
  const [row] = group.rows;
  assert.ok(row);
  const response = {
    view: "overdue",
    groups: [group],
    page: 1,
    pageSize: 10,
    total: 1,
    pageCount: 1,
    counts: { all: 1, paid: 0, overdue: 1 },
  };

  for (const invalidRow of [
    { ...row, status: "PAID" },
    { ...row, status: "UPCOMING" },
    { ...row, overdueDays: 0 },
    { ...row, collectibleBalanceCents: 0 },
  ]) {
    const invalid = { ...response, groups: [{ ...group, rows: [invalidRow] }] };
    assert.equal(financeInstallmentsOutputSchema.safeParse(invalid).success, false);
  }
});

function overdueGroupFixture(): FinanceOverduePayerGroup {
  const payer = { id: "00000000-0000-4000-8000-000000000001", name: "Pagador" };
  const beneficiary = { studentId: "00000000-0000-4000-8000-000000000002", fullName: "Ana" };
  const row = {
    installmentId: "00000000-0000-4000-8000-000000000003",
    orderId: "00000000-0000-4000-8000-000000000004",
    origin: "TUITION" as const,
    sequenceNumber: 1,
    scheduleTotal: 1,
    payer,
    beneficiaries: [beneficiary],
    dueDate: "2026-02-28",
    originalAmountCents: 10_000,
    expectedAmountCents: 9000,
    paidAmountCents: 3000,
    collectibleBalanceCents: 6000,
    status: "OVERDUE" as const,
    overdueDays: 1,
  };
  const group = {
    payer,
    installmentCount: 1,
    collectibleBalanceCents: 6000,
    maxOverdueDays: 1,
    beneficiaries: [beneficiary],
    rows: [row],
  };
  return group;
}

void it("preserves all flat-view statuses and requires the exact civil date format", () => {
  const [row] = overdueGroupFixture().rows;
  assert.ok(row);
  for (const status of ["OVERDUE", "PAID", "WAIVED", "DUE_THIS_MONTH", "UPCOMING"]) {
    assert.deepEqual(financeInstallmentRowSchema.parse({ ...row, status }), { ...row, status });
  }
  for (const dueDate of [
    "x2026-02-28",
    "2026-02-28x",
    "2026-aa-28",
    "aaaa-02-28",
    "2026-02-aa",
    "6-02-28",
    "2026-2-28",
    "2026-02-8",
  ]) {
    assert.equal(financeInstallmentRowSchema.safeParse({ ...row, dueDate }).success, false);
  }
});

void it("preserves the flat response contract for all and paid", () => {
  for (const view of ["all", "paid"]) {
    assert.deepEqual(financeInstallmentsInputSchema.parse({ view }), {
      view,
      page: 1,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    });
    const response = {
      view,
      rows: [],
      page: 1,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
      total: 0,
      pageCount: 0,
      counts: { all: 0, paid: 0, overdue: 0 },
    };
    assert.deepEqual(financeInstallmentsOutputSchema.parse(response), response);
  }
});
