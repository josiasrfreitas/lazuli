import assert from "node:assert/strict";
import { test } from "node:test";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import {
  normalizeFilters,
  queryInput,
  searchPatch,
  statusPatch,
} from "../../src/features/installments/filters.js";
import { businessDate, installmentVm } from "../../src/features/installments/view-model.js";

const DUE_DATE = "2026-09-01";
const TODAY = "2026-09-15";
const SEARCH_LIMIT = 80;
const EXCESS_SEARCH_LENGTH = 81;

const row: FinanceInstallmentRow = {
  installmentId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  sequenceNumber: 6,
  scheduleTotal: 12,
  payer: { id: "33333333-3333-4333-8333-333333333333", name: "Maria" },
  beneficiaries: [],
  dueDate: DUE_DATE,
  originalAmountCents: 35_000,
  expectedAmountCents: 36_000,
  paidAmountCents: 10_000,
  collectibleBalanceCents: 26_000,
  status: "OVERDUE",
  overdueDays: 14,
};
void test("shared URLs map paid, defaults and temporarily disabled overdue safely", () => {
  assert.deepEqual(
    queryInput(normalizeFilters({ status: "pagas", search: " Ana " }, { page: 2, pageSize: 25 })),
    {
      view: "paid",
      search: "Ana",
      page: 2,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    },
  );
  assert.deepEqual(
    queryInput(normalizeFilters({ status: "unknown", search: null }, { page: 1, pageSize: 25 })),
    {
      view: "all",
      search: "",
      page: 1,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    },
  );
  assert.equal(
    normalizeFilters(
      { status: null, search: "a".repeat(EXCESS_SEARCH_LENGTH) },
      { page: 1, pageSize: 25 },
    ).search.length,
    SEARCH_LIMIT,
  );
});
void test("filter changes remove pagination", () => {
  assert.deepEqual(searchPatch("Ana"), { search: "Ana" });
  assert.deepEqual(searchPatch(""), { search: null });
  assert.deepEqual(statusPatch("pagas"), { status: "pagas" });
  assert.deepEqual(statusPatch("todas"), { status: null });
});
void test("financial presentation preserves original value and the API's adjusted partial balance", () => {
  const vm = installmentVm(row, TODAY);
  assert.deepEqual(vm, {
    sequence: "06/12",
    dueDate: "01/09/2026",
    amount: "R$\u00A0350,00",
    balance: "Saldo em aberto: R$\u00A0260,00",
    badge: { label: "Vencida há 14 dias", variant: "destructive" },
  });
  assert.equal(installmentVm({ ...row, paidAmountCents: 0 }, TODAY).balance, null);
  assert.equal(installmentVm({ ...row, collectibleBalanceCents: 0 }, TODAY).balance, null);
  assert.deepEqual(installmentVm({ ...row, overdueDays: 1 }, TODAY).badge, {
    label: "Vencida há 1 dia",
    variant: "destructive",
  });
});
void test("civil dates and due-today warnings respect Sao Paulo and settled status precedence", () => {
  assert.equal(businessDate(new Date("2026-09-02T02:59:59Z")), DUE_DATE);
  assert.equal(businessDate(new Date("2026-09-02T03:00:00Z")), "2026-09-02");
  for (const status of ["DUE_THIS_MONTH", "UPCOMING"] as const) {
    assert.deepEqual(installmentVm({ ...row, status }, DUE_DATE).badge, {
      label: "Vence hoje",
      variant: "warning",
    });
    assert.deepEqual(installmentVm({ ...row, status }, "2026-08-31").badge, {
      label: "A vencer",
      variant: "neutral",
    });
  }
  assert.deepEqual(installmentVm({ ...row, status: "PAID" }, row.dueDate).badge, {
    label: "Paga",
    variant: "success",
  });
  assert.deepEqual(installmentVm({ ...row, status: "WAIVED" }, row.dueDate).badge, {
    label: "Dispensada",
    variant: "neutral",
  });
});
