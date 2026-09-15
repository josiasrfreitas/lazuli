import assert from "node:assert/strict";
import test from "node:test";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TablePagination } from "@lazuli/ui";
import type { StudentListRow } from "@lazuli/validators";

import type { StudentsFilters } from "../../src/features/students/logic.js";
import { paginationFor } from "../../src/features/students/students-page.js";
import { StudentsTable } from "../../src/features/students/students-table.js";
import { StudentsControls, StudentsHeader } from "../../src/features/students/students-toolbar.js";
import { statusTabsVm } from "../../src/features/students/view-model.js";

const PAGE_SIZE = 10;
const LARGE_PAGE_SIZE = 25;
const TAB_COUNT = 3;
const FACT_COLUMN_COUNT = 3;
const TABLE_ROW: StudentListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Beatriz Rocha",
  isMinor: false,
  status: "ACTIVE",
  phone: null,
  enrollment: null,
  attendance: { percent: 0.5, flagged: true },
  finance: { kind: "upToDate" },
};

const filters: StudentsFilters = {
  busca: "",
  pagina: 1,
  pageSize: PAGE_SIZE,
  setBusca: () => {},
  setPagina: () => {},
  setPageSize: () => {},
  setStatusTab: () => {},
  statusTab: "todos" as const,
};

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void test("first load preserves pagination furniture and only skeletonizes fetched values", () => {
  const pagination = paginationFor(undefined, filters);

  assert.notEqual(pagination, null);
  assert.equal(pagination.page, 1);
  assert.equal(pagination.pageSize, PAGE_SIZE);
  assert.equal(pagination.loading, true);

  const paginationMarkup = renderToStaticMarkup(
    createElement(TablePagination, {
      itemLabel: { singular: "aluno", plural: "alunos" },
      page: 1,
      loading: true,
      pageSize: PAGE_SIZE,
      pageSizeOptions: [PAGE_SIZE, LARGE_PAGE_SIZE],
    }),
  );

  assert.match(paginationMarkup, />1–10 de /u);
  assert.match(paginationMarkup, />Itens por página/u);
  assert.match(paginationMarkup, />10</u);
  assert.match(paginationMarkup, />Página <span[^>]*>1<\/span> de /u);
  assert.equal((paginationMarkup.match(/data-slot="inline-skeleton"/gu) ?? []).length, 2);
});

void test("first load keeps header and tab labels while skeletonizing their counts", () => {
  const headerMarkup = renderToStaticMarkup(createElement(StudentsHeader, { summary: undefined }));
  const controlsMarkup = renderToStaticMarkup(
    createElement(StudentsControls, {
      filters,
      onNewStudent: () => {},
      tabs: statusTabsVm(),
    }),
  );

  assert.match(headerMarkup, />Alunos</u);
  assert.match(headerMarkup, /alunos · /u);
  assert.match(headerMarkup, /turmas ativas/u);
  assert.equal((headerMarkup.match(/data-slot="inline-skeleton"/gu) ?? []).length, 2);

  assert.match(controlsMarkup, />Todos</u);
  assert.match(controlsMarkup, />Ativos</u);
  assert.match(controlsMarkup, />Inativos</u);
  assert.equal((controlsMarkup.match(/data-slot="inline-skeleton"/gu) ?? []).length, TAB_COUNT);
});

void test("fixed student columns and fact tones survive a static class declaration", () => {
  const markup = renderToStaticMarkup(
    createElement(StudentsTable, {
      state: { kind: "data", rows: [TABLE_ROW] },
      onRetry: () => {},
      onSelectRow: () => {},
      pagination: {
        loading: false,
        onPageChange: () => {},
        onPageSizeChange: () => {},
        page: 1,
        pageCount: 1,
        pageSize: PAGE_SIZE,
        totalItems: 1,
      },
      selectedId: null,
    }),
  );

  assert.match(markup, /w-\[30%\]/u);
  assert.match(markup, /w-\[17%\]/u);
  assert.equal((markup.match(/w-\[15%\]/gu) ?? []).length, FACT_COLUMN_COUNT);
  assert.match(markup, /text-destructive/u);
  assert.match(markup, /text-success/u);
});
