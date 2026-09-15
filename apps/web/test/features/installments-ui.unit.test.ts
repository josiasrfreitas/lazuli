import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TablePagination } from "@lazuli/ui";
import { InstallmentsTable } from "../../src/features/installments/installments-table.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const SMALL_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE = 25;
const LARGE_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [SMALL_PAGE_SIZE, DEFAULT_PAGE_SIZE, LARGE_PAGE_SIZE];
const COLUMN_COUNT = 6;

void test("fixed installment pagination hides the size selector while Students retains it", () => {
  const props = {
    page: 2,
    pageSize: 25,
    pageCount: 2,
    totalItems: 30,
    itemLabel: { singular: "parcela", plural: "parcelas" },
  };
  const fixed = renderToStaticMarkup(createElement(TablePagination, props));
  assert.match(fixed, /26–30 de /u);
  assert.match(fixed, /parcelas/u);
  assert.doesNotMatch(fixed, /Itens por página/u);
  const selectable = renderToStaticMarkup(
    createElement(TablePagination, { ...props, pageSizeOptions: PAGE_SIZE_OPTIONS }),
  );
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
