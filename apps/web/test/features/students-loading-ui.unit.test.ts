import assert from "node:assert/strict";
import test from "node:test";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TablePagination } from "@lazuli/ui";

import type { StudentsFilters } from "../../src/features/students/logic.js";
import { paginationFor } from "../../src/features/students/students-page.js";
import { StudentsControls, StudentsHeader } from "../../src/features/students/students-toolbar.js";
import { statusTabsVm } from "../../src/features/students/view-model.js";

const PAGE_SIZE = 10;
const LARGE_PAGE_SIZE = 25;
const TAB_COUNT = 3;

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
