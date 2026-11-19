import assert from "node:assert/strict";
import { it } from "node:test";
import { reviewPlan, reviewPlacement, reviewPeriod } from "../support/formation-review.js";
import { createElement, type ReactElement } from "react";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { OrganizationAgenda } from "../../src/features/class-organization/agenda.js";
import type {
  ClassPlan,
  OrganizationBoard,
  Placement,
} from "../../src/features/class-organization/model.js";
import { ReviewGroups } from "../../src/features/class-organization/review-groups.js";
import {
  restoreReviewFormationLocation,
  reviewStudentHref,
} from "../../src/features/class-organization/review-navigation.js";
import { renderWithQueries } from "../support/query-render.js";

const page = "/turmas/formacao";
const site = "https://school.test";
const search = {
  semestre: "next-term",
  visao: "review",
  vinculos: "confirmed",
  busca: "Ana B",
  ordemVinculos: "nome",
  atencaoVinculo: "material",
  estagioOrigem: "essentials-1",
  grupoVinculo: "another-group",
  vinculo: "another-placement",
};

void it("returns from the placement's formation sheet to the filtered student, group and original schedule panel", () => {
  const current = new URLSearchParams({
    ...search,
    busca: "Ana & Júlia",
    turma: "grade-class",
    alunoFormacao: "grade-student",
  });
  const before = current.toString();
  const target = new URL(
    reviewStudentHref(page, { current, rowId: "placement-ana", groupId: "origin:class-42" }),
    site,
  );
  const detail = target.searchParams;
  assert.equal(target.pathname, page);
  assert.equal(detail.get("alunoFormacao"), "placement-ana");
  assert.equal(detail.get("retornoFormacao"), "review");
  assert.equal(detail.has("visao"), false);
  assert.equal(detail.has("turma"), false);
  assert.equal(detail.has("leadFormacao"), false);
  assert.equal(current.toString(), before);

  restoreReviewFormationLocation(detail);
  assert.deepEqual(Object.fromEntries(detail), {
    ...search,
    busca: "Ana & Júlia",
    turma: "grade-class",
    alunoFormacao: "grade-student",
    grupoVinculo: "origin:class-42",
    vinculo: "placement-ana",
  });
});

void it("restores a lead opened from the schedule and supports a standalone sheet without a previous panel", () => {
  const fromLead = new URLSearchParams({ visao: "review", leadFormacao: "lead-before-review" });
  const child = new URL(
    reviewStudentHref(page, { current: fromLead, rowId: "placement", groupId: "unassigned" }),
    site,
  );
  assert.equal(child.searchParams.has("leadFormacao"), false);
  restoreReviewFormationLocation(child.searchParams);
  assert.deepEqual(Object.fromEntries(child.searchParams), {
    visao: "review",
    leadFormacao: "lead-before-review",
    grupoVinculo: "unassigned",
    vinculo: "placement",
  });

  const direct = new URLSearchParams({
    alunoFormacao: "placement",
    retornoFormacao: "review",
    grupoVinculo: "unassigned",
    vinculo: "placement",
    precisaTurma: "true",
  });
  restoreReviewFormationLocation(direct);
  assert.deepEqual(Object.fromEntries(direct), {
    visao: "review",
    grupoVinculo: "unassigned",
    vinculo: "placement",
    precisaTurma: "true",
  });
});

const destination: ClassPlan = {
  ...reviewPlan,
  id: "plan-afternoon",
  name: "Turma das quartas",
  className: null,
  scheduleType: "REGULAR",
  sharedStageId: "essentials-2",
  stageCode: "E2",
  stageName: "Essentials 2",
  teacherName: "Paula",
  active: true,
  previousStudentCount: 0,
  enrolledStudentIds: [],
  slots: [{ weekday: "WEDNESDAY", startTime: "21:20", endTime: "22:20" }],
};

const ready: Placement = {
  ...reviewPlacement,
  id: "placement-ana",
  studentId: "student-ana",
  studentName: "Ana Beatriz",
  studentAge: null,
  semesterId: "next-term",
  planId: destination.id,
  mode: "ADVANCE",
  continuity: "STAY",
  confirmation: "PRECONFIRMED",
  continuityReason: null,
  notes: null,
  attentionNote: null,
  effectiveDate: new Date("2027-01-20T00:00:00Z"),
  publishedAt: null,
  declinedAt: null,
  entryStatus: null,
  stageId: "essentials-2",
  stageName: "Essentials 2",
  sourceStageId: "essentials-1",
  sourceStageName: "Essentials 1",
  sourceStageCode: "E1",
  sourceClassId: "class-mondays",
  sourceClassName: "Turma das segundas",
  sourceScheduleType: "REGULAR",
  sourceTeacher: "Marina",
  sourceSchedule: [{ weekday: "MONDAY", startTime: "13:10", endTime: "14:10" }],
  sourceProgressId: "progress",
  sourceEnrollmentId: "enrollment",
  sourceSemesterId: "last-term",
  attention: {
    rollover: true,
    lowHealth: false,
    healthScore: 90,
    materialMissing: false,
    contractStatus: "COVERED",
    coverageThrough: null,
    grades: "SUFFICIENT",
    gradesIncomplete: false,
    gradeAverage: 8,
    attendance: 0.95,
    attendanceFlagged: false,
  },
  blockers: [],
};

function boardFor(row: Placement): OrganizationBoard {
  return {
    semester: reviewPeriod,
    nextSemester: null,
    studentsTotal: 1,
    studentsProposed: 1,
    plans: [destination],
    placements: [row],
    waitingLeads: [],
  };
}

function renderAt(element: ReactElement, current: URLSearchParams): string {
  const location = createElement(
    PathnameContext.Provider,
    { value: page },
    createElement(SearchParamsContext.Provider, { value: current }, element),
  );
  return renderWithQueries(
    createElement(NuqsTestingAdapter, { searchParams: current, children: location }),
  );
}

void it("links the name in the grouped results to the formation sheet, independently from batch selection", () => {
  const current = new URLSearchParams({
    ...search,
    grupoVinculo: destination.id,
    vinculo: ready.id,
  });
  const options = {
    board: boardFor(ready),
    groups: [
      { kind: "plan" as const, id: destination.id, plan: destination, rows: [ready], leads: [] },
    ],
    ended: false,
    working: false,
    selectedIds: new Set<string>(),
    onMark: () => {},
    onOpenPlan: () => {},
    onLead: () => {},
  };
  const html = renderAt(createElement(ReviewGroups, options), current);
  const anchor = html.match(
    /<a\b(?=[^>]*id="review-student-placement-ana")[^>]*>[\s\S]*?<\/a>/u,
  )?.[0];
  assert.ok(anchor, "the student's return-focus target must be a navigable link");
  assert.match(anchor, /Ana Beatriz/u);
  assert.doesNotMatch(anchor, /aria-expanded=|role="checkbox"|type="checkbox"/u);
  assert.match(html, /id="review-select-student-placement-ana"/u);
  const href = /\bhref="([^"]+)"/u.exec(anchor)?.[1];
  assert.ok(href);
  const target = new URL(href.replaceAll("&amp;", "&"), site);
  assert.equal(target.pathname, page);
  assert.equal(target.searchParams.get("alunoFormacao"), "placement-ana");
  assert.equal(target.searchParams.get("grupoVinculo"), destination.id);
  assert.equal(target.searchParams.get("vinculos"), "confirmed");
  assert.equal(target.searchParams.get("busca"), "Ana B");
});

function sheetMarkup(
  row: Placement,
  {
    group,
    today,
    current = new URLSearchParams(search),
  }: { group: string; today: string; current?: URLSearchParams },
): string {
  const url = new URL(reviewStudentHref(page, { current, rowId: row.id, groupId: group }), site);
  const html = renderAt(
    createElement(OrganizationAgenda, {
      selected: url.searchParams.get("turma"),
      board: boardFor(row),
      today,
      onAction: () => {},
      onSelect: () => {},
      prepare: () => {},
      preparing: false,
      clearFilters: () => {},
      scope: "all",
      query: "",
      rosterFilters: { forPlan: () => ({ status: "all", risk: "all" }), update: () => {} },
    }),
    url.searchParams,
  );
  const panel = /<aside\b[^>]*id="formation-panel"[^>]*>([\s\S]*?)<\/aside>/u.exec(html)?.[1];
  assert.ok(panel, "the destination must render the individual formation sheet");
  assert.match(panel, /<h1\b[^>]*id="formation-panel-heading"[^>]*>Ana Beatriz<\/h1>/u);
  return panel;
}

function readableText(html: string): string {
  return html
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

void it("omits the allocation review button from the individual sheet", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-19T12:00:00Z") });
  const panel = sheetMarkup(ready, {
    group: destination.id,
    today: "2026-11-19",
    current: new URLSearchParams(search),
  });
  assert.doesNotMatch(
    readableText(panel),
    /Revisar alocação|Registrar intervenção|Acompanhamento da equipe/u,
  );
  assert.match(readableText(panel), /Compra registrada/u);
  const signaled = sheetMarkup(
    { ...ready, exitRiskActive: true, confirmation: "BLOCKED" },
    { group: destination.id, today: "2026-11-19" },
  );
  assert.match(readableText(signaled), /Registrar intervenção/u);
});

void it("shows the destination class start only for new students assigned to a class", () => {
  const entry: Placement = {
    ...reviewPlacement,
    studentName: ready.studentName,
    planId: destination.id,
    mode: "ENTRY",
    effectiveDate: ready.effectiveDate,
  };
  const text = (row: Placement): string =>
    readableText(sheetMarkup(row, { group: destination.id, today: "2026-11-19" }));
  assert.match(text(entry), /Data de início da turma 06\/01\/2027/u);
  assert.doesNotMatch(text(entry), /20\/01\/2027/u);
  for (const row of [
    ready,
    { ...ready, publishedAt: new Date("2027-01-08") },
    { ...entry, planId: null },
    { ...entry, sourceEnrollmentId: "previous-enrollment" },
  ]) {
    assert.doesNotMatch(text(row), /Data de início da turma|Vigência/iu);
  }
});

void it("shows the student's reason on the formation sheet without presenting a refused class as the proposal", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-19T12:00:00Z") });
  const text = readableText(
    sheetMarkup(
      {
        ...ready,
        confirmation: "CHANGING",
        continuity: "CHANGE",
        continuityReason: "O novo trabalho impede as aulas à noite.",
        blockers: ["Escolha a nova turma para continuar.", "Aprovação pedagógica pendente"],
      },
      {
        group: "unassigned",
        today: "2026-11-19",
        current: new URLSearchParams({ ...search, vinculos: "all" }),
      },
    ),
  );
  assert.match(text, /O novo trabalho impede as aulas à noite\./u);
  assert.match(text, /13:10–14:10/u);
  assert.match(text, /Aprovação pedagógica pendente/iu);
  assert.doesNotMatch(
    text,
    /Ver turma proposta|(?:Proposta|Horário proposto)[^.!?]{0,65}(?:Turma das quartas|21:20–22:20)/u,
  );
});

void it("keeps the cancelled publication's local date and author beside its unresolved blocker", () => {
  const text = readableText(
    sheetMarkup(
      {
        ...ready,
        publishedAt: new Date("2027-01-08T01:15:00Z"),
        publishedBy: "Marina Lopes",
        entryStatus: "CANCELLED",
        blockers: ["A entrada programada mudou"],
      },
      { group: destination.id, today: "2027-07-19" },
    ),
  );
  assert.match(text, /cancelad[ao]/iu);
  assert.match(text, /07\/01\/2027/u);
  assert.match(text, /Marina Lopes/u);
  assert.match(text, /A entrada programada mudou/iu);
});
