import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallmentsPagination } from "../../src/features/installments/installments-page.js";
import { InstallmentsTable } from "../../src/features/installments/installments-table.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const COLUMN_COUNT = 6;

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
void test("table retains six semantic columns and distinguishes loading, empty, filtered and error", () => {
  const base = { error: false, filtered: false, updating: false, onRetry: () => {}, footer: null };
  const loading = renderToStaticMarkup(
    createElement(InstallmentsTable, { ...base, rows: undefined, updating: true }),
  );
  assert.equal((loading.match(/<th /gu) ?? []).length, COLUMN_COUNT);
  assert.match(loading, /Lista de parcelas/u);
  assert.match(loading, /aria-busy="true"/u);
  for (const label of ["Parcela", "Pagador", "Beneficiário(s)", "Vencimento", "Valor", "Status"]) {
    assert.ok(loading.includes(label), `missing column ${label}`);
  }
  const empty = renderToStaticMarkup(createElement(InstallmentsTable, { ...base, rows: [] }));
  assert.match(empty, /Nenhuma parcela cadastrada/u);
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
