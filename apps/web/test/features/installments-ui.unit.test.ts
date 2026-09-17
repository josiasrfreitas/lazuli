import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinanceOverduePayerGroup } from "@lazuli/validators";
import { InstallmentsPagination } from "../../src/features/installments/installments-page.js";
import { InstallmentsTable } from "../../src/features/installments/installments-table.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const COLUMN_COUNT = 6;
const PAYER_ONE_ID = "11111111-1111-4111-8111-111111111111";
const PAYER_TWO_ID = "22222222-2222-4222-8222-222222222222";
const INSTALLMENT_ONE_ID = "66666666-6666-4666-8666-666666666666";

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function overdueGroup(payerId: string, installmentId: string): FinanceOverduePayerGroup {
  const beneficiaries = [
    { studentId: "33333333-3333-4333-8333-333333333333", fullName: "Ana Ribeiro" },
    { studentId: "44444444-4444-4444-8444-444444444444", fullName: "João Ribeiro" },
  ];
  return {
    payer: { id: payerId, name: "Responsável Homônimo com Nome Muito Longo" },
    installmentCount: 1,
    collectibleBalanceCents: 26_000,
    maxOverdueDays: 14,
    beneficiaries,
    rows: [
      {
        installmentId,
        orderId: "55555555-5555-4555-8555-555555555555",
        sequenceNumber: 6,
        scheduleTotal: 12,
        payer: { id: payerId, name: "Responsável Homônimo com Nome Muito Longo" },
        beneficiaries,
        dueDate: "2026-09-01",
        originalAmountCents: 35_000,
        expectedAmountCents: 36_000,
        paidAmountCents: 10_000,
        collectibleBalanceCents: 26_000,
        status: "OVERDUE",
        overdueDays: 14,
      },
    ],
  };
}

function overduePaginationMarkup(page: number): string {
  return renderToStaticMarkup(
    createElement(InstallmentsPagination, {
      data: {
        view: "overdue",
        page,
        pageSize: 10,
        pageCount: 2,
        total: 11,
        groups: [],
        counts: { all: 30, paid: 2, overdue: 24 },
      },
      filters: { status: "vencidas", search: "", page, pageSize: 50 },
      setPage: () => {},
      setPageSize: () => {},
    }),
  );
}

void test("installment pagination exposes the same size choices as Students", () => {
  const selectable = renderToStaticMarkup(
    createElement(InstallmentsPagination, {
      data: {
        view: "all",
        page: 2,
        pageSize: 25,
        pageCount: 2,
        total: 30,
        rows: [],
        counts: { all: 30, paid: 0, overdue: 0 },
      },
      filters: { status: null, search: "", page: 2, pageSize: 25 },
      setPage: () => {},
      setPageSize: () => {},
    }),
  );
  assert.match(selectable, /26–30 de /u);
  assert.match(selectable, /parcelas/u);
  assert.match(selectable, /Itens por página/u);
});
void test("overdue pagination counts payer groups and has no size selector", () => {
  assert.match(overduePaginationMarkup(1), /1–10 de .*11.* pagadores/u);
  assert.match(overduePaginationMarkup(2), /11–11 de .*11.* pagadores/u);
  assert.doesNotMatch(overduePaginationMarkup(1), /Itens por página/u);
});
void test("table retains six semantic columns and distinguishes loading, empty, filtered and error", () => {
  const base = { error: false, filtered: false, updating: false, onRetry: () => {}, footer: null };
  const loading = renderToStaticMarkup(
    createElement(InstallmentsTable, { ...base, rows: undefined, updating: true }),
  );
  assert.equal((loading.match(/<th /gu) ?? []).length, COLUMN_COUNT);
  assert.match(loading, /Lista de parcelas/u);
  assert.match(loading, /aria-busy="true"/u);
  assert.match(loading, />Parcela</u);
  assert.match(loading, />Pagador</u);
  assert.match(loading, />Beneficiário\(s\)</u);
  assert.match(loading, />Vencimento</u);
  assert.match(loading, />Valor</u);
  assert.match(loading, />Status</u);
  const empty = renderToStaticMarkup(createElement(InstallmentsTable, { ...base, rows: [] }));
  assert.match(empty, /Nenhuma parcela cadastrada/u);
  const overdueEmpty = renderToStaticMarkup(
    createElement(InstallmentsTable, { ...base, groups: [] }),
  );
  assert.match(overdueEmpty, /Nenhuma parcela cadastrada/u);
  const filtered = renderToStaticMarkup(
    createElement(InstallmentsTable, { ...base, rows: [], filtered: true }),
  );
  assert.match(filtered, /Nenhuma parcela encontrada/u);
  const error = renderToStaticMarkup(
    createElement(InstallmentsTable, { ...base, rows: undefined, error: true }),
  );
  assert.match(error, /Não foi possível carregar as parcelas/u);
  assert.match(error, /Tentar de novo/u);
});
void test("overdue error takes precedence over previously loaded groups", () => {
  const markup = renderToStaticMarkup(
    createElement(InstallmentsTable, {
      groups: [overdueGroup(PAYER_ONE_ID, INSTALLMENT_ONE_ID)],
      error: true,
      filtered: false,
      updating: false,
      onRetry: () => {},
      footer: null,
    }),
  );
  assert.match(markup, /Não foi possível carregar as parcelas/u);
  assert.match(markup, /Tentar de novo/u);
  assert.doesNotMatch(markup, /data-slot="overdue-payer-group"/u);
});
void test("overdue groups preserve API identity, order, values and table associations", () => {
  const groups = [
    overdueGroup(PAYER_ONE_ID, INSTALLMENT_ONE_ID),
    overdueGroup(PAYER_TWO_ID, "77777777-7777-4777-8777-777777777777"),
  ];
  const markup = renderToStaticMarkup(
    createElement(InstallmentsTable, {
      groups,
      error: false,
      filtered: false,
      updating: false,
      onRetry: () => {},
      footer: null,
    }),
  );
  assert.equal(countMatches(markup, /data-slot="overdue-payer-group"/gu), groups.length);
  assert.ok(markup.indexOf(PAYER_ONE_ID) < markup.indexOf(PAYER_TWO_ID));
  // A joint order has one installment row, not one charge per beneficiary.
  assert.equal(countMatches(markup, /<tbody[^>]*><tr /gu), groups.length);
  assert.equal(countMatches(markup, /Ana /gu), groups.length);
  assert.equal(countMatches(markup, /João /gu), groups.length);
  // The API balance includes a R$10 adjustment and R$100 payment on R$350.
  // Both the payer total and the primary row amount must show R$260, not R$250 or R$350.
  assert.equal(
    countMatches(markup, /<strong[^>]*>R\$\u00A0260,00<\/strong>/giu),
    groups.length * 2,
  );
  assert.equal(countMatches(markup, /Original: R\$\u00A0350,00/giu), groups.length);
  assert.doesNotMatch(markup, /R\$\u00A0250,00/u);
  assert.equal(countMatches(markup, /R\$\u00A090,00/giu), groups.length);
  // Every cell must reference a real column header in its own named table.
  const tables = [
    ...markup.matchAll(/<table\b[^>]*aria-labelledby="([^"]+)"[^>]*>(.*?)<\/table>/gu),
  ];
  assert.equal(tables.length, groups.length);
  for (const [, headingId, table] of tables) {
    assert.ok(
      [...markup.matchAll(/<h2[^>]*id="([^"]+)"/gu)].some((match) => match[1] === headingId),
    );
    const headers = [...table!.matchAll(/<th\b[^>]*id="([^"]+)"/gu)].map((match) => match[1]);
    const cells = [...table!.matchAll(/<td\b[^>]*headers="([^"]+)"/gu)];
    assert.equal(cells.length, headers.length);
    for (const [, header] of cells) assert.ok(headers.includes(header));
  }
  assert.doesNotMatch(markup, /<(?:button|a)\b|type="checkbox"|aria-expanded=/u);
});
void test("overdue search explains that qualified payer groups remain complete", () => {
  const group = overdueGroup(PAYER_ONE_ID, INSTALLMENT_ONE_ID);
  const markup = renderToStaticMarkup(
    createElement(InstallmentsTable, {
      groups: [group],
      error: false,
      filtered: true,
      showOverdueSearchGuidance: true,
      updating: false,
      onRetry: () => {},
      footer: null,
    }),
  );
  assert.match(markup, /Exibindo todas as parcelas vencidas dos pagadores encontrados\./u);
  assert.match(markup, /Ana /u);
  assert.match(markup, /João /u);
  assert.equal(countMatches(markup, /data-slot="table-row"/gu), group.rows.length + 1);
});
