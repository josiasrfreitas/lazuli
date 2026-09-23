import assert from "node:assert/strict";
import test from "node:test";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TableFilterChips, TablePagination } from "@lazuli/ui";
import { studentPaginationPolicy, type StudentListRow } from "@lazuli/validators";

import type { StudentsFilters } from "../../src/features/students/logic.js";
import { tablePaginationPropsFor } from "../../src/lib/pagination.js";
import { StudentsTable } from "../../src/features/students/students-table.js";
import { StudentsTableRow } from "../../src/features/students/students-table-row.js";
import { studentFilterFields } from "../../src/features/students/student-filter-fields.js";
import { StudentsControls, StudentsHeader } from "../../src/features/students/students-toolbar.js";

const PAGE_SIZE = 10;
const LARGE_PAGE_SIZE = 25;
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

const NEUTRAL_FACTS_ROW: StudentListRow = {
  ...TABLE_ROW,
  id: "22222222-2222-4222-8222-222222222222",
  fullName: "Bruno Lima Santos",
  attendance: { percent: 0.75, flagged: false },
  finance: { kind: "none" },
};

const EMPTY_FACTS_ROW: StudentListRow = {
  ...TABLE_ROW,
  id: "33333333-3333-4333-8333-333333333333",
  fullName: "Carla Dias Souza",
  attendance: { percent: null, flagged: false },
  finance: { kind: "none" },
  enrollment: {
    enrollmentId: "44444444-4444-4444-8444-444444444444",
    classId: "55555555-5555-4555-8555-555555555555",
    classCode: "REG-A1",
    scheduleLabel: "Seg e Qua · 19:00",
    teacherName: "João Silva",
  },
  phone: "+5582999999999",
};

const filters: StudentsFilters = {
  search: "",
  page: 1,
  pageSize: PAGE_SIZE,
  setSearch: () => {},
  setPage: () => {},
  setPageSize: () => {},
  situations: [],
  classIds: [],
  teacherIds: [],
  registeredFrom: "",
  registeredTo: "",
  setFilters: () => {},
};
const missing: { data?: never } = {};
(globalThis as typeof globalThis & { React: typeof React }).React = React;

function studentRowMarkup(row: StudentListRow): string {
  return renderToStaticMarkup(
    createElement(StudentsTableRow, { onSelect: () => {}, row, selected: false }),
  );
}

void test("first load preserves pagination furniture and only skeletonizes fetched values", () => {
  const pagination = tablePaginationPropsFor(
    {
      page: filters.page,
      pageSize: filters.pageSize,
      pageSizeOptions: studentPaginationPolicy.pageSizeOptions,
      setPage: filters.setPage,
      setPageSize: filters.setPageSize,
    },
    missing.data,
  );

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

void test("first load keeps header and filter controls while skeletonizing header counts", () => {
  const filterFields = studentFilterFields({
    filters,
    classOptions: [],
    teacherOptions: [],
    classSearch: "",
    teacherSearch: "",
    classResult: { status: "idle", query: "" },
    teacherResult: { status: "idle", query: "" },
    onClassSearchChange: () => {},
    onTeacherSearchChange: () => {},
  });
  const headerMarkup = renderToStaticMarkup(createElement(StudentsHeader, { summary: undefined }));
  const controlsMarkup = renderToStaticMarkup(
    createElement(StudentsControls, {
      filters,
      onNewStudent: () => {},
      fields: filterFields,
    }),
  );

  assert.match(headerMarkup, />Alunos</u);
  assert.match(headerMarkup, /alunos · /u);
  assert.match(headerMarkup, /turmas ativas/u);
  assert.equal((headerMarkup.match(/data-slot="inline-skeleton"/gu) ?? []).length, 2);

  assert.match(controlsMarkup, />Turma</u);
  assert.match(controlsMarkup, />Situação</u);
  assert.match(controlsMarkup, /Mais filtros/u);
  assert.doesNotMatch(controlsMarkup, />Professor</u);
  assert.doesNotMatch(controlsMarkup, /data-slot="inline-skeleton"/u);
});

void test("selected student filter fields render removable chips", () => {
  const fields = studentFilterFields({
    filters: { ...filters, teacherIds: [TABLE_ROW.id] },
    classOptions: [],
    teacherOptions: [{ id: TABLE_ROW.id, label: "João Silva" }],
    classSearch: "",
    teacherSearch: "",
    classResult: { status: "idle", query: "" },
    teacherResult: { status: "idle", query: "" },
    onClassSearchChange: () => {},
    onTeacherSearchChange: () => {},
  });
  const markup = renderToStaticMarkup(createElement(TableFilterChips, { fields }));

  assert.match(markup, /Professor: João Silva/u);
  assert.match(markup, /Remover filtro Professor/u);
});

void test("fixed student columns and fact tones survive a static class declaration", () => {
  const tableMarkup = renderToStaticMarkup(
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
  const flaggedFactsMarkup = studentRowMarkup(TABLE_ROW);
  const neutralFactsMarkup = studentRowMarkup(NEUTRAL_FACTS_ROW);
  const emptyFactsMarkup = studentRowMarkup(EMPTY_FACTS_ROW);

  assert.match(tableMarkup, /w-\[30%\]/u);
  assert.match(tableMarkup, /w-\[17%\]/u);
  assert.equal((tableMarkup.match(/w-\[15%\]/gu) ?? []).length, FACT_COLUMN_COUNT);
  assert.match(
    flaggedFactsMarkup,
    /<td class="[^"]*text-destructive[^"]*"[^>]*><span[^>]*>50%<\/span><\/td>/u,
  );
  assert.match(
    flaggedFactsMarkup,
    /<td class="[^"]*text-success[^"]*"[^>]*><span[^>]*>Em dia<\/span><\/td>/u,
  );
  assert.doesNotMatch(
    neutralFactsMarkup,
    /<td class="[^"]*text-(?:muted-foreground|success|destructive)[^"]*"[^>]*><span class="font-numeric">75%<\/span><\/td>/u,
  );
  assert.equal(
    (
      emptyFactsMarkup.match(
        /<td class="[^"]*text-muted-foreground[^"]*"[^>]*><span class="">—<\/span><\/td>/gu,
      ) ?? []
    ).length,
    2,
  );
});
