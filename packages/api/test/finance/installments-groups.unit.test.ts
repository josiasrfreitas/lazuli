import assert from "node:assert/strict";
import { it } from "node:test";

import type { FinanceOverduePayerGroup } from "@lazuli/validators";

import {
  groupOverdueRows,
  type LoadedBeneficiaries,
  type OverdueGroupRow,
} from "../../src/finance/installments-groups.js";

const PAYER_A = "00000000-0000-4000-8000-000000000001";
const PAYER_B = "00000000-0000-4000-8000-000000000002";
const ORDER_A = "00000000-0000-4000-8000-000000000003";
const ORDER_B = "00000000-0000-4000-8000-000000000004";
const ORDER_C = "00000000-0000-4000-8000-000000000005";
const STUDENT_A = "00000000-0000-4000-8000-000000000006";
const STUDENT_B = "00000000-0000-4000-8000-000000000007";
const PAYER_A_COUNT = 2;
const PAYER_A_BALANCE = 12_000;
const PAYER_A_DAYS = 30;
const PAYER_B_BALANCE = 4000;
const PAYER_B_DAYS = 5;
const INSTALLMENT_AMOUNT = 10_000;
const ROW_PAID = 4000;
const ROW_BALANCE = 6000;

type GroupSummary = {
  payer: FinanceOverduePayerGroup["payer"];
  installmentCount: number;
  balance: number;
  days: number;
  students: FinanceOverduePayerGroup["beneficiaries"];
  orderIds: string[];
  rowPayers: FinanceOverduePayerGroup["rows"][number]["payer"][];
};

void it("groups every row by payer and keeps beneficiaries unique and payer-scoped", () => {
  const ana = { studentId: STUDENT_A, fullName: "Ana" };
  const bia = { studentId: STUDENT_B, fullName: "Bia" };
  const beneficiaries: LoadedBeneficiaries = {
    byOrder: new Map([
      [ORDER_A, [ana]],
      [ORDER_B, [ana]],
      [ORDER_C, [bia]],
    ]),
    ordered: [ana, ana, bia],
  };
  const payerB = {
    payerId: PAYER_B,
    payerName: "Pagador B",
    installmentCount: 1,
    groupBalanceCents: PAYER_B_BALANCE,
    maxOverdueDays: PAYER_B_DAYS,
  };
  const groups = groupOverdueRows(
    [overdueRow({ orderId: ORDER_A }), overdueRow({ orderId: ORDER_B }), overdueRow(payerB)],
    beneficiaries,
  );

  assert.deepEqual(summarize(groups[0]), {
    payer: { id: PAYER_A, name: "Pagador A" },
    installmentCount: PAYER_A_COUNT,
    balance: PAYER_A_BALANCE,
    days: PAYER_A_DAYS,
    students: [ana],
    orderIds: [ORDER_A, ORDER_B],
    rowPayers: [
      { id: PAYER_A, name: "Pagador A" },
      { id: PAYER_A, name: "Pagador A" },
    ],
  });
  assert.deepEqual(summarize(groups[1]), {
    payer: { id: PAYER_B, name: "Pagador B" },
    installmentCount: 1,
    balance: PAYER_B_BALANCE,
    days: PAYER_B_DAYS,
    students: [bia],
    orderIds: [ORDER_C],
    rowPayers: [{ id: PAYER_B, name: "Pagador B" }],
  });
});

void it("returns no groups when the selected payer page is empty", () => {
  assert.deepEqual(groupOverdueRows([], { byOrder: new Map(), ordered: [] }), []);
});

function summarize(
  group: ReturnType<typeof groupOverdueRows>[number] | undefined,
): GroupSummary | undefined {
  return (
    group && {
      payer: group.payer,
      installmentCount: group.installmentCount,
      balance: group.collectibleBalanceCents,
      days: group.maxOverdueDays,
      students: group.beneficiaries,
      orderIds: group.rows.map((row) => row.orderId),
      rowPayers: group.rows.map((row) => row.payer),
    }
  );
}

function overdueRow(overrides: Partial<OverdueGroupRow> = {}): OverdueGroupRow {
  return {
    installmentId: "00000000-0000-4000-8000-000000000008",
    orderId: ORDER_C,
    sequenceNumber: 1,
    scheduleTotal: PAYER_A_COUNT,
    payerId: PAYER_A,
    payerName: "Pagador A",
    dueDate: "2026-01-01",
    dueDateSort: "2026-01-01",
    originalAmountCents: INSTALLMENT_AMOUNT,
    expectedAmountCents: INSTALLMENT_AMOUNT,
    paidAmountCents: ROW_PAID,
    collectibleBalanceCents: ROW_BALANCE,
    status: "OVERDUE",
    overdueDays: PAYER_A_DAYS,
    installmentCount: PAYER_A_COUNT,
    groupBalanceCents: PAYER_A_BALANCE,
    maxOverdueDays: PAYER_A_DAYS,
    ...overrides,
  };
}
