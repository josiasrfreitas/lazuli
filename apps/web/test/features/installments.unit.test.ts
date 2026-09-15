import assert from "node:assert/strict";
import { test } from "node:test";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import {
  normalizeFilters,
  queryInput,
  searchPatch,
  statusPatch,
  validPage,
} from "../../src/features/installments/filters.js";
import { businessDate, installmentVm } from "../../src/features/installments/view-model.js";

const DUE_DATE = "2026-09-01";
const TODAY = "2026-09-15";
const SEARCH_LIMIT = 80;
const EXCESS_SEARCH_LENGTH = 81;
const OUT_OF_RANGE_PAGE = 9;
const LAST_PAGE = 3;
const LARGER_PAGE_COUNT = 4;

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
  assert.deepEqual(queryInput(normalizeFilters({ status: "pagas", busca: " Ana ", pagina: "2" })), {
    view: "paid",
    search: "Ana",
    page: 2,
  });
  assert.deepEqual(normalizeFilters({ status: "vencidas", busca: "Ana", pagina: "9" }), {
    status: null,
    busca: "Ana",
    pagina: 1,
  });
  assert.deepEqual(queryInput(normalizeFilters({ status: "unknown", busca: null, pagina: "-5" })), {
    view: "all",
    search: "",
    page: 1,
  });
  for (const pagina of [null, "0", "abc", "2.5", "9007199254740992"]) {
    assert.equal(normalizeFilters({ status: null, busca: null, pagina }).pagina, 1);
  }
  assert.equal(
    normalizeFilters({ status: null, busca: "a".repeat(EXCESS_SEARCH_LENGTH), pagina: null }).busca
      .length,
    SEARCH_LIMIT,
  );
});
void test("filter changes remove pagination and pagination stays within the response total", () => {
  assert.deepEqual(searchPatch("Ana"), { busca: "Ana", pagina: null });
  assert.deepEqual(searchPatch(""), { busca: null, pagina: null });
  assert.deepEqual(statusPatch("pagas"), { status: "pagas", pagina: null });
  assert.deepEqual(statusPatch("todas"), { status: null, pagina: null });
  assert.equal(validPage(OUT_OF_RANGE_PAGE, LAST_PAGE), LAST_PAGE);
  assert.equal(validPage(OUT_OF_RANGE_PAGE, 0), 1);
  assert.equal(validPage(2, LARGER_PAGE_COUNT), 2);
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
