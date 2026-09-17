import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FINANCE_INSTALLMENTS_PAGE_SIZE,
  FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
  type FinanceInstallmentRow,
  type FinanceOverduePayerGroup,
} from "@lazuli/validators";
import {
  normalizeFilters,
  queryInput,
  searchPatch,
  statusPatch,
} from "../../src/features/installments/filters.js";
import {
  effectivePageCorrection,
  sameInstallmentsQueryScope,
} from "../../src/features/installments/logic.js";
import {
  abbreviatedPersonName,
  businessDate,
  installmentVm,
  overduePayerSummaryVm,
} from "../../src/features/installments/view-model.js";

const DUE_DATE = "2026-09-01";
const TODAY = "2026-09-15";
const SEARCH_LIMIT = 80;
const EXCESS_SEARCH_LENGTH = 81;

void test("installment results persist only across pagination and refetch of the same view and search", () => {
  const current = { view: "overdue" as const, search: "Ana" };
  assert.equal(sameInstallmentsQueryScope({ ...current }, current), true);
  assert.equal(sameInstallmentsQueryScope({ view: "overdue", search: "Bia" }, current), false);
  assert.equal(sameInstallmentsQueryScope({ view: "all", search: "Ana" }, current), false);
  assert.equal(sameInstallmentsQueryScope(undefined, current), false);
});

void test("effective responses correct invalid pages for grouped overdue results", () => {
  assert.equal(
    effectivePageCorrection({ page: 4, pageCount: 2, placeholder: false, fetching: false }),
    2,
  );
  assert.equal(
    effectivePageCorrection({ page: 4, pageCount: 2, placeholder: true, fetching: false }),
    null,
  );
  assert.equal(
    effectivePageCorrection({ page: 4, pageCount: 2, placeholder: false, fetching: true }),
    null,
  );
  assert.equal(
    effectivePageCorrection({ page: 2, pageCount: 2, placeholder: false, fetching: false }),
    null,
  );
});

void test("student display names keep the first name and second-name initial", () => {
  assert.equal(abbreviatedPersonName("Ana Beatriz Rocha"), "Ana B.");
  assert.equal(abbreviatedPersonName("Isadora"), "Isadora");
});

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
void test("shared URLs map every installment view and preserve the flat page size", () => {
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
    queryInput(
      normalizeFilters({ status: "vencidas", search: " Ana " }, { page: 2, pageSize: 50 }),
    ),
    {
      view: "overdue",
      search: "Ana",
      page: 2,
      pageSize: FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
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
  assert.deepEqual(statusPatch("vencidas"), { status: "vencidas" });
  assert.deepEqual(statusPatch("todas"), { status: null });
});
void test("financial presentation preserves original value and the API's adjusted partial balance", () => {
  const vm = installmentVm(row, TODAY);
  assert.deepEqual(vm, {
    sequence: "6 de 12",
    dueDate: "01/09/2026",
    amount: "R$\u00A0350,00",
    balance: "Restante: R$\u00A0260,00",
    badge: { label: "Vencida há 14 dias", variant: "destructive" },
  });
  assert.equal(installmentVm({ ...row, paidAmountCents: 0 }, TODAY).balance, null);
  assert.equal(installmentVm({ ...row, collectibleBalanceCents: 0 }, TODAY).balance, null);
  assert.deepEqual(installmentVm({ ...row, overdueDays: 1 }, TODAY).badge, {
    label: "Vencida há 1 dia",
    variant: "destructive",
  });
});
void test("overdue payer summary uses the API collectible total instead of summing original amounts", () => {
  const group: FinanceOverduePayerGroup = {
    payer: row.payer,
    installmentCount: 3,
    collectibleBalanceCents: 26_000,
    maxOverdueDays: 45,
    beneficiaries: [
      { studentId: "44444444-4444-4444-8444-444444444444", fullName: "Ana Souza" },
      { studentId: "55555555-5555-4555-8555-555555555555", fullName: "João Souza" },
    ],
    rows: [
      { ...row, status: "OVERDUE" },
      { ...row, installmentId: "66666666-6666-4666-8666-666666666666", status: "OVERDUE" },
      {
        ...row,
        installmentId: "77777777-7777-4777-8777-777777777777",
        orderId: "88888888-8888-4888-8888-888888888888",
        status: "OVERDUE",
      },
    ],
  };
  assert.equal(overduePayerSummaryVm(group).balance, "R$\u00A0260,00");
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
