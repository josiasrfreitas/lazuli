import assert from "node:assert/strict";
import { it } from "node:test";
import { reviewPlacement as draft, reviewPeriod, reviewPlan } from "../support/formation-review.js";
import { periodConfirmation } from "@lazuli/domain";
import {
  atRisk,
  significantReduction,
} from "../../src/features/class-organization/formation-calendar.js";
import { isReadyForAllocation } from "../../src/features/class-organization/confirmation.js";
import type { PublishSemesterInput } from "@lazuli/validators";
import type { OrganizationBoard, Placement } from "../../src/features/class-organization/model.js";
import {
  REVIEW_NO_ORIGIN,
  reviewResults,
  type ReviewCriteria,
} from "../../src/features/class-organization/review-filters.js";
import {
  groupReviewRows,
  isReviewDeparture,
  reviewDestinationId,
  reviewGroupName,
  reviewRowComparator,
} from "../../src/features/class-organization/review-group-model.js";
import {
  reviewBlockers,
  reviewEffectiveDate,
  reviewStatus,
} from "../../src/features/class-organization/review-model.js";
import { publishReviewBatch } from "../../src/features/class-organization/review-publish.js";

void it("separates the family response, readiness, and publication", () => {
  const staying = { ...draft, continuity: "STAY" as const };
  assert.equal(reviewStatus({ ...draft, mode: "ENTRY" }, false).label, "Entrada a confirmar");
  assert.equal(reviewStatus(staying, false).label, "Transferência a confirmar");
  assert.equal(
    reviewStatus({ ...staying, confirmation: "BLOCKED", blockers: ["Professor pendente"] }, false)
      .label,
    "Continuidade bloqueada",
  );
  assert.equal(reviewStatus({ ...draft, continuity: "LEAVING" }, false).label, "Risco de saída");
  assert.equal(reviewStatus(staying, true).label, "Sem alocação");
});

void it("labels scheduled and applied memberships as confirmed in the class", () => {
  const scheduled = {
    ...draft,
    publishedAt: new Date("2026-11-05T12:00:00Z"),
    sourceExitActionId: "paired-exit",
    sourceSemesterId: "current-term",
    entryStatus: "SCHEDULED" as const,
  };
  const transfer = { ...scheduled, sourceSemesterId: scheduled.semesterId };
  assert.equal(reviewStatus(scheduled, false).label, "Confirmado na turma");
  assert.equal(reviewStatus(transfer, false).label, "Confirmado na turma");
  assert.equal(
    reviewStatus({ ...transfer, entryStatus: "APPLIED" }, true).label,
    "Confirmado na turma",
  );
  assert.equal(
    reviewStatus({ ...transfer, entryStatus: "CANCELLED" }, false).label,
    "Revisar vínculo",
  );
});

void it("shows the publication's civil date and keeps distinct actual blockers", () => {
  const board = { semester: { startDate: new Date("2027-01-05T00:00:00Z") } };
  assert.equal(reviewEffectiveDate({ effectiveDate: null }, board), "2027-01-05");
  assert.equal(
    reviewEffectiveDate({ effectiveDate: new Date("2027-02-08T00:00:00Z") }, board),
    "2027-02-08",
  );
  assert.deepEqual(
    reviewBlockers({
      blockers: [
        "Escolha a nova turma para continuar.",
        "Escolha uma turma planejada",
        "Professor pendente na data de entrada",
      ],
    }),
    ["Definir a turma de destino", "Professor pendente na data de entrada"],
  );
});

void it("reports the confirmed class and keeps the failed and unattempted classes in a partial batch", async () => {
  const plans = [
    { id: "a", name: "Essentials 2", version: 4 },
    { id: "b", name: "PPT da tarde", version: 2 },
    { id: "c", name: "Intermediário", version: 7 },
  ];
  const selected = [
    { id: "first", planId: "a", version: 3 },
    { id: "second", planId: "b", version: 1 },
    { id: "third", planId: "a", version: 5 },
    { id: "fourth", planId: "c", version: 6 },
  ];
  const calls: PublishSemesterInput[] = [];
  const result = await publishReviewBatch({ plans, selected }, (input) => {
    calls.push(input);
    if (input.planId === "b") return Promise.reject(new Error("A proposta mudou."));
    return Promise.resolve({ count: input.placements.length });
  });
  assert.deepEqual(
    calls.map((input) => input.planId),
    ["a", "b"],
  );
  assert.deepEqual(calls[0]?.placements, [
    { id: "first", version: 3 },
    { id: "third", version: 5 },
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.appliedIds, ["first", "third"]);
  assert.match(result.message, /2 vínculos confirmados \(Essentials 2\)/u);
  assert.match(result.message, /em PPT da tarde\. A proposta mudou\./u);
  assert.match(result.message, /2 propostas restantes/u);
});

const criteria: ReviewCriteria = {
  busca: "",
  vinculos: null,
  destinoVinculo: null,
  estagioVinculo: null,
  origemVinculo: null,
  estagioOrigem: null,
  atencaoVinculo: null,
  professorVinculo: null,
  modalidadeVinculo: null,
  saidaVinculo: null,
  reducaoSignificativa: false,
  turmasEmRisco: false,
  precisaTurma: false,
  ordemVinculos: "destino",
};

const attention: Placement["attention"] = {
  rollover: true,
  lowHealth: false,
  healthScore: null,
  materialMissing: false,
  contractStatus: "COVERED",
  coverageThrough: null,
  grades: "SUFFICIENT",
  gradesIncomplete: false,
  gradeAverage: 8,
  attendance: 95,
  attendanceFlagged: false,
};

type PlacementOverrides = Omit<Partial<Placement>, "continuity"> & {
  continuity?: Parameters<typeof periodConfirmation>[0]["continuity"];
};

function placement(id: string, overrides: PlacementOverrides = {}): Placement {
  const row = {
    ...draft,
    id,
    studentName: id,
    planId: "class-2",
    stageId: "essentials-2",
    sourceClassId: null,
    sourceClassName: null,
    sourceSchedule: [],
    sourceScheduleType: null,
    sourceTeacher: null,
    sourceStageId: null,
    effectiveDate: null,
    attention,
    ...overrides,
  };
  return {
    ...row,
    confirmation:
      overrides.confirmation ??
      periodConfirmation({
        continuity: overrides.continuity ?? "UNDECIDED",
        declined: Boolean(row.declinedAt),
        enrolled: Boolean(row.publishedAt),
        continuing: Boolean(row.planId) && row.mode !== "ENTRY",
        ready: Boolean(row.planId) && row.blockers.length === 0,
      }),
  };
}

type Lead = OrganizationBoard["waitingLeads"][number];
function waitingLead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    id,
    fullName: id,
    studentId: null,
    stageId: "essentials-2",
    stage: null,
    allocationPlanId: null,
    allocationPlan: null,
    allocationPendingReason: null,
    scheduleType: null,
    format: null,
    notes: null,
    ...overrides,
  };
}

function reviewBoard(placements: Placement[], waitingLeads: Lead[] = []): OrganizationBoard {
  return {
    semester: { ...reviewPeriod, startDate: new Date("2027-01-05T00:00:00Z") },
    plans: [
      { ...reviewPlan, id: "class-10", name: "Turma 10" },
      { ...reviewPlan, id: "class-2", name: "Turma 2" },
    ],
    placements,
    waitingLeads,
    nextSemester: null,
    studentsTotal: placements.length,
    studentsProposed: placements.length,
  };
}

const rowIds = (rows: Placement[]): string[] => rows.map(({ id }) => id);
const recordedOn = new Date("2026-11-05T12:00:00Z");
const changeRequest: PlacementOverrides = {
  continuity: "CHANGE",
  blockers: ["Escolha a nova turma para continuar."],
};

void it("counts readiness separately from the family response and published or declined records", () => {
  const board = reviewBoard([
    placement("no-response"),
    placement("staying-blocked", {
      continuity: "STAY",
      confirmation: "BLOCKED",
      blockers: ["Professor pendente"],
    }),
    placement("no-destination", { planId: null }),
    placement("change", changeRequest),
    placement("possible-exit", { continuity: "LEAVING" }),
    placement("published", { publishedAt: recordedOn, confirmation: "CONFIRMED" }),
    placement("declined", { declinedAt: recordedOn }),
  ]);
  const ready = reviewResults(board, { criteria, scope: "ready" });
  assert.deepEqual(rowIds(ready.rows), ["no-response"]);
  assert.deepEqual(ready.counts, {
    all: 7,
    pending: 5,
    ready: 1,
    blocked: 2,
    published: 1,
  });
  assert.deepEqual(rowIds(reviewResults(board, { criteria, scope: "blocked" }).rows), [
    "staying-blocked",
    "possible-exit",
  ]);
});

void it("keeps allocation and readiness independent from presumed continuity", () => {
  const board = reviewBoard(
    [
      placement("staying-blocked", {
        continuity: "STAY",
        confirmation: "BLOCKED",
        blockers: ["Professor pendente"],
      }),
      placement("enrolled", {
        publishedAt: recordedOn,
        entryStatus: "APPLIED",
        confirmation: "CONFIRMED",
      }),
      placement("preconfirmed", { confirmation: "PRECONFIRMED" }),
      placement("published-change", {
        publishedAt: recordedOn,
        continuity: "CHANGE",
        confirmation: "CONFIRMED",
      }),
      placement("possible-exit", { continuity: "LEAVING", confirmation: "LEAVING" }),
      placement("exit", {
        publishedAt: recordedOn,
        declinedAt: recordedOn,
        confirmation: "LEAVING",
      }),
    ],
    [waitingLead("assigned", { allocationPlanId: "class-2" })],
  );
  assert.deepEqual(reviewResults(board, { criteria, scope: "all" }).counts, {
    all: 7,
    pending: 4,
    ready: 1,
    blocked: 1,
    published: 2,
  });
  assert.deepEqual(rowIds(reviewResults(board, { criteria, scope: "published" }).rows), [
    "enrolled",
    "published-change",
  ]);
  assert.deepEqual(rowIds(reviewResults(board, { criteria, scope: "ready" }).rows), [
    "preconfirmed",
  ]);
});

void it("keeps unconfirmed proposals, confirmed allocations and recorded exits distinct in a closed period", () => {
  const board = reviewBoard([
    placement("unconfirmed"),
    placement("enrolled", { publishedAt: recordedOn, entryStatus: "APPLIED" }),
    placement("withdrawn", { declinedAt: recordedOn }),
  ]);
  const all = reviewResults(board, { criteria, scope: "all" });
  assert.deepEqual(
    all.rows.map((row) => reviewStatus(row, true).label),
    ["Sem alocação", "Confirmado na turma", "Não vai continuar"],
  );
  assert.deepEqual(rowIds(reviewResults(board, { criteria, scope: "pending" }).rows), [
    "unconfirmed",
  ]);
  assert.deepEqual(rowIds(reviewResults(board, { criteria, scope: "published" }).rows), [
    "enrolled",
  ]);
});

void it("combines an accent-insensitive name, destination and target stage before counting scopes", () => {
  const board = reviewBoard([
    placement("ready", { studentName: "João Dias" }),
    placement("published", {
      studentName: "João Alves",
      publishedAt: recordedOn,
      confirmation: "CONFIRMED",
    }),
    placement("other-stage", { studentName: "João Cruz", stageId: "essentials-1" }),
    placement("other-class", { studentName: "João Costa", planId: "class-10" }),
    placement("other-name", { studentName: "Caio Cruz" }),
    placement("declined", { studentName: "João Lima", declinedAt: recordedOn }),
  ]);
  const filters = {
    ...criteria,
    busca: " JOAO ",
    destinoVinculo: "class-2",
    estagioVinculo: "essentials-2",
  };
  const result = reviewResults(board, { criteria: filters, scope: "pending" });
  assert.deepEqual(rowIds(result.rows), ["ready"]);
  assert.deepEqual(result.counts, {
    all: 2,
    pending: 1,
    ready: 1,
    blocked: 0,
    published: 1,
  });
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...criteria, estagioVinculo: "essentials-2" },
        scope: "all",
      }).rows,
    ),
    ["ready", "published", "other-class", "other-name"],
  );
});

void it("includes a requested replacement even with a former destination or existing enrollment", () => {
  const board = reviewBoard([
    placement("unassigned", { planId: null }),
    placement("change-with-destination", changeRequest),
    placement("published-change", {
      publishedAt: recordedOn,
      entryStatus: "APPLIED",
      continuity: "CHANGE",
    }),
    placement("new-destination-saved", { planId: "class-10" }),
    placement("published", { publishedAt: recordedOn }),
    placement("legacy-enrollment", { publishedAt: recordedOn, planId: null }),
    placement("possible-exit", { continuity: "LEAVING", planId: null }),
    placement("declined", { ...changeRequest, declinedAt: recordedOn }),
  ]);
  const filters = { ...criteria, precisaTurma: true };
  const all = reviewResults(board, { criteria: filters, scope: "all" });
  assert.deepEqual(rowIds(all.rows), ["unassigned", "change-with-destination", "published-change"]);
  assert.deepEqual(all.counts, {
    all: 3,
    pending: 2,
    ready: 0,
    blocked: 0,
    published: 1,
  });
  assert.deepEqual(rowIds(reviewResults(board, { criteria: filters, scope: "published" }).rows), [
    "published-change",
  ]);
});

void it("orders destinations numerically, dates by effective start, and ties consistently by name and id", () => {
  const february = new Date("2027-02-08T00:00:00Z");
  const board = reviewBoard([
    placement("c", { studentName: "Ágata", planId: "class-10", effectiveDate: february }),
    placement("e", {
      studentName: "Ana",
      planId: null,
      effectiveDate: new Date("2027-01-20T00:00:00Z"),
    }),
    placement("b", { studentName: "Ágata", planId: "class-10", effectiveDate: february }),
    placement("f", { studentName: "Aline", declinedAt: recordedOn, effectiveDate: recordedOn }),
    placement("a", { studentName: "Agata", planId: "class-10", effectiveDate: february }),
    placement("d", { studentName: "Bruna" }),
  ]);
  const rows = board.placements;
  assert.deepEqual(rowIds(rows.toSorted(reviewRowComparator(board, "nome"))), [
    "a",
    "b",
    "c",
    "f",
    "e",
    "d",
  ]);
  assert.deepEqual(rowIds(rows.toSorted(reviewRowComparator(board, "destino"))), [
    "d",
    "a",
    "b",
    "c",
    "f",
    "e",
  ]);
  assert.deepEqual(rowIds(rows.toSorted(reviewRowComparator(board, "vigencia"))), [
    "d",
    "e",
    "a",
    "b",
    "c",
    "f",
  ]);
  assert.deepEqual(rowIds(rows), ["c", "e", "b", "f", "a", "d"]);
});

void it("places each record once in its actual destination or its corresponding review queue", () => {
  const board = reviewBoard(
    [
      placement("regular-change", { ...changeRequest, sourceClassId: "origin" }),
      placement("unassigned", { planId: null }),
      placement("published-change", { publishedAt: recordedOn, continuity: "CHANGE" }),
      placement("new-entry", { planId: "class-10", sourceClassId: null }),
      placement("declined", { declinedAt: recordedOn }),
      placement("possible-exit", { continuity: "LEAVING" }),
    ],
    [
      waitingLead("lead-with-class", { allocationPlanId: "class-2" }),
      waitingLead("lead-without-class"),
    ],
  );
  board.plans = board.plans.map((plan) => ({
    ...plan,
    className: plan.id === "class-2" ? "PPT 2" : "PPT 10",
    name: plan.id === "class-2" ? "Rascunho Z" : "Rascunho A",
  }));
  const groups = groupReviewRows(board, {
    rows: board.placements,
    leads: board.waitingLeads,
    order: "destino",
  });
  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      rows: rowIds(group.rows),
      leads: group.leads.map((lead) => lead.id),
    })),
    [
      { id: "class-2", rows: ["published-change"], leads: ["lead-with-class"] },
      { id: "class-10", rows: ["new-entry"], leads: [] },
      { id: "unassigned", rows: ["regular-change", "unassigned"], leads: [] },
      { id: "origin:none", rows: ["declined", "possible-exit"], leads: [] },
      { id: "leads", rows: [], leads: ["lead-without-class"] },
    ],
  );
  const destination = reviewResults(board, {
    criteria: { ...criteria, destinoVinculo: "class-2" },
    scope: "all",
  });
  assert.deepEqual(rowIds(destination.rows), ["published-change"]);
  assert.deepEqual(
    destination.leads.map((lead) => lead.id),
    ["lead-with-class"],
  );
});

function departuresBoard(): OrganizationBoard {
  const current = { sourceClassId: "physical-origin", sourceClassName: "Turma de origem 2" };
  const schedule: Placement["sourceSchedule"] = [
    { weekday: "MONDAY", startTime: "09:00", endTime: "10:00" },
  ];
  const board = reviewBoard(
    [
      placement("recorded", { ...current, continuity: "LEAVING", declinedAt: recordedOn }),
      placement("published-possible", {
        ...current,
        publishedAt: recordedOn,
        continuity: "LEAVING",
      }),
      placement("inherited-possible", {
        sourceClassId: "inherited",
        sourceClassName: "Antiga turma verde",
        continuity: "LEAVING",
      }),
      placement("split-recorded", {
        sourceClassId: "split",
        sourceClassName: "Turma de origem 10",
        sourceSchedule: schedule,
        sourceScheduleType: "REGULAR",
        sourceTeacher: "Lia",
        declinedAt: recordedOn,
      }),
      placement("known-without-plan", {
        sourceClassId: "orphan",
        sourceClassName: "Turma de origem 7",
        declinedAt: recordedOn,
      }),
      placement("no-origin", { continuity: "LEAVING" }),
      placement("enrolled", { publishedAt: recordedOn }),
    ],
    [waitingLead("lead", { allocationPlanId: "class-2" })],
  );
  const template = board.plans[0]!;
  board.plans = [
    {
      ...template,
      id: "class-2",
      className: "Destino 10",
      classId: "destination-class",
      sourceClassId: "physical-origin",
    },
    {
      ...template,
      id: "origin-plan",
      className: current.sourceClassName,
      classId: current.sourceClassId,
      sourceClassId: "split",
    },
    {
      ...template,
      id: "split-plan",
      className: "Outra turma",
      classId: "split-class",
      sourceClassId: "split",
    },
    {
      ...template,
      id: "successor",
      className: null,
      name: "Continuação verde",
      classId: null,
      sourceClassId: "inherited",
    },
  ];
  return board;
}

void it("keeps departures in their source class, preferring its physical identity and preserving the separate published destination", () => {
  const board = departuresBoard();
  const groups = groupReviewRows(board, {
    rows: board.placements,
    leads: board.waitingLeads,
    order: "destino",
  });
  assert.deepEqual(
    groups.map((group) => reviewGroupName(group)),
    [
      "Antiga turma verde",
      "Destino 10",
      "Turma de origem 2",
      "Turma de origem 7",
      "Turma de origem 10",
      "Sem turma de origem",
    ],
  );
  assert.deepEqual(
    groups.map((group) => [group.id, rowIds(group.rows)]),
    [
      ["origin:inherited", ["inherited-possible"]],
      ["class-2", ["enrolled"]],
      ["origin-plan", ["published-possible", "recorded"]],
      ["origin:orphan", ["known-without-plan"]],
      ["origin:split", ["split-recorded"]],
      ["origin:none", ["no-origin"]],
    ],
  );
  const origin = groups.find((group) => group.id === "origin:split")?.origin;
  assert.deepEqual(origin, {
    classId: "split",
    name: "Turma de origem 10",
    teacherName: "Lia",
    scheduleType: "REGULAR",
    schedule: [{ weekday: "MONDAY", startTime: "09:00", endTime: "10:00" }],
  });
  assert.equal(groups.at(-1)?.origin?.classId, null);
  assert.equal(groups.flatMap((group) => group.rows).length, board.placements.length);
  assert.deepEqual(
    groups.flatMap((group) => group.leads.map((lead) => [group.id, lead.id])),
    [["class-2", "lead"]],
  );
  assert.equal(
    reviewDestinationId(board.placements.find((row) => row.id === "published-possible")!),
    "class-2",
  );
  assert.equal(
    reviewDestinationId(board.placements.find((row) => row.id === "inherited-possible")!),
    null,
  );
  board.plans.reverse();
  assert.deepEqual(
    groupReviewRows(board, {
      rows: board.placements,
      leads: board.waitingLeads,
      order: "destino",
    }).map((group) => group.id),
    groups.map((group) => group.id),
  );
});

void it("intersects the departure type with origin, destination, group search and scope without returning leads or eligible students", () => {
  const board = departuresBoard();
  const allDepartures: ReviewCriteria = { ...criteria, saidaVinculo: "todas" };
  const all = reviewResults(board, { criteria: allDepartures, scope: "all" });
  assert.equal(all.rows.length, 6);
  assert.ok(all.rows.every(isReviewDeparture));
  assert.deepEqual(all.leads, []);
  assert.deepEqual(all.counts, {
    all: 6,
    pending: 2,
    ready: 0,
    blocked: 2,
    published: 1,
  });
  assert.deepEqual(reviewResults(board, { criteria: allDepartures, scope: "ready" }).rows, []);
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...allDepartures, saidaVinculo: "possivel" },
        scope: "all",
      }).rows,
    ),
    ["published-possible", "inherited-possible", "no-origin"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: {
          ...allDepartures,
          saidaVinculo: "registrada",
          origemVinculo: "physical-origin",
        },
        scope: "all",
      }).rows,
    ),
    ["recorded"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...allDepartures, origemVinculo: "physical-origin" },
        scope: "all",
      }).rows,
    ),
    ["recorded", "published-possible"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...allDepartures, origemVinculo: REVIEW_NO_ORIGIN },
        scope: "all",
      }).rows,
    ),
    ["no-origin"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...allDepartures, destinoVinculo: "class-2" },
        scope: "all",
      }).rows,
    ),
    ["published-possible"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, {
        criteria: { ...allDepartures, busca: "antiga turma verde" },
        scope: "all",
      }).rows,
    ),
    ["inherited-possible"],
  );
  assert.deepEqual(
    reviewResults(board, {
      criteria: { ...allDepartures, busca: "continuação verde" },
      scope: "all",
    }).rows,
    [],
  );
  const searches = [
    ["destino 10", "published-possible"],
    ["turma de origem 10", "split-recorded"],
    ["sem turma de origem", "no-origin"],
  ] as const;
  for (const [busca, id] of searches) {
    assert.deepEqual(
      rowIds(reviewResults(board, { criteria: { ...allDepartures, busca }, scope: "all" }).rows),
      [id],
    );
  }
});

void it("sorts groups by their earliest visible student or lead name, and by individual effective dates", () => {
  const board = reviewBoard(
    [
      placement("late", { studentName: "Zélia", effectiveDate: new Date("2027-03-01") }),
      placement("first", {
        planId: "class-10",
        studentName: "Caio",
        effectiveDate: new Date("2027-02-01"),
      }),
      placement("second", {
        planId: "class-10",
        studentName: "Bruno",
        effectiveDate: new Date("2027-02-03"),
      }),
    ],
    [
      waitingLead("lead-twenty", { fullName: "Lead 20", allocationPlanId: "class-2" }),
      waitingLead("lead-early", { fullName: "Ágata", allocationPlanId: "class-2" }),
      waitingLead("lead-ten", { fullName: "Lead 10", allocationPlanId: "class-2" }),
      waitingLead("untimed", { fullName: "Ana" }),
    ],
  );
  const named = groupReviewRows(board, {
    rows: board.placements,
    leads: board.waitingLeads,
    order: "nome",
  });
  assert.deepEqual(
    named.map((group) => group.id),
    ["class-2", "leads", "class-10"],
  );
  assert.deepEqual(
    named[0]?.leads.map((lead) => lead.id),
    ["lead-early", "lead-ten", "lead-twenty"],
  );
  assert.deepEqual(
    named[2]?.rows.map((row) => row.id),
    ["second", "first"],
  );
  const dated = groupReviewRows(board, {
    rows: board.placements,
    leads: board.waitingLeads,
    order: "vigencia",
  });
  assert.deepEqual(
    dated.map((group) => group.id),
    ["class-10", "class-2", "leads"],
  );
  assert.deepEqual(
    dated[0]?.rows.map((row) => row.id),
    ["first", "second"],
  );
});

void it("preserves origin, previous stage and attention filters while keeping new arrivals discoverable", () => {
  const fromPriorStage = {
    sourceClassId: "old-class",
    sourceStageId: "essentials-1",
    sourceProgressId: "progress",
  };
  const board = reviewBoard(
    [
      placement("contract", {
        ...fromPriorStage,
        blockers: ["Contrato pendente"],
        attention: { ...attention, contractStatus: "MISSING" },
      }),
      placement("grades", {
        ...fromPriorStage,
        attention: { ...attention, grades: "NEEDS_SUPPORT" },
      }),
      placement("different-origin", {
        ...fromPriorStage,
        sourceClassId: "other",
        attention: { ...attention, contractStatus: "MISSING" },
      }),
      placement("entry"),
    ],
    [waitingLead("waiting")],
  );
  const prior = reviewResults(board, {
    criteria: {
      ...criteria,
      origemVinculo: "old-class",
      estagioOrigem: "essentials-1",
      atencaoVinculo: "contract",
    },
    scope: "all",
  });
  assert.deepEqual(rowIds(prior.rows), ["contract"]);
  assert.deepEqual(prior.leads, []);
  const grades = reviewResults(board, {
    criteria: { ...criteria, atencaoVinculo: "grades" },
    scope: "all",
  });
  assert.deepEqual(rowIds(grades.rows), ["grades"]);
  assert.equal(grades.counts.all, 1);
  const newEntries = reviewResults(board, {
    criteria: { ...criteria, origemVinculo: REVIEW_NO_ORIGIN },
    scope: "pending",
  });
  assert.deepEqual(rowIds(newEntries.rows), ["entry"]);
  assert.deepEqual(
    newEntries.leads.map((lead) => lead.id),
    ["waiting"],
  );
  assert.equal(newEntries.counts.pending, 2);
});

void it("searches by the destination's actual name, intersects filters and counts visible leads only in applicable scopes", () => {
  const board = reviewBoard(
    [
      placement("ready", { studentName: "Bia" }),
      placement("another-stage", { studentName: "Lia", stageId: "advanced" }),
      placement("old-class-change", changeRequest),
    ],
    [
      waitingLead("assigned", { fullName: "Caio", allocationPlanId: "class-2" }),
      waitingLead("unassigned-lead", { fullName: "José" }),
    ],
  );
  board.plans = board.plans.map((plan) => ({
    ...plan,
    className: plan.id === "class-2" ? "Manhã 2" : null,
    stageName: plan.id === "class-2" ? "Essentials 2" : null,
  }));
  const search = { ...criteria, busca: " MANHA 2 ", estagioVinculo: "essentials-2" };
  const all = reviewResults(board, { criteria: search, scope: "all" });
  assert.deepEqual(rowIds(all.rows), ["ready"]);
  assert.deepEqual(
    rowIds(
      reviewResults(board, { criteria: { ...search, busca: "Essentials 2" }, scope: "all" }).rows,
    ),
    ["ready"],
  );
  assert.deepEqual(
    all.leads.map((lead) => lead.id),
    ["assigned"],
  );
  assert.deepEqual(all.counts, {
    all: 2,
    pending: 2,
    ready: 1,
    blocked: 0,
    published: 0,
  });
  assert.deepEqual(reviewResults(board, { criteria: search, scope: "ready" }).leads, []);
  assert.deepEqual(reviewResults(board, { criteria: search, scope: "blocked" }).leads, []);
  assert.deepEqual(reviewResults(board, { criteria: search, scope: "published" }).leads, []);
  assert.deepEqual(
    reviewResults(board, { criteria: { ...criteria, busca: "jose" }, scope: "all" }).leads.map(
      (lead) => lead.id,
    ),
    ["unassigned-lead"],
  );
  assert.deepEqual(
    reviewResults(board, { criteria, scope: "all", ended: true }).leads.map((lead) => lead.id),
    ["assigned"],
  );
});

void it("selects a valid transfer and new entry in the batch while counting only the continuing student as preconfirmed", () => {
  const board = reviewBoard([
    placement("cohort", { confirmation: "PRECONFIRMED" }),
    placement("transfer", { confirmation: "PENDING" }),
    placement("entry", { mode: "ENTRY", confirmation: "PENDING" }),
    placement("blocked", { confirmation: "BLOCKED", blockers: ["Notas insuficientes"] }),
    placement("scheduled", {
      publishedAt: recordedOn,
      entryStatus: "SCHEDULED",
      confirmation: "CONFIRMED",
    }),
  ]);
  const results = reviewResults(board, { criteria, scope: "all" });
  assert.deepEqual(results.counts, { all: 5, pending: 4, ready: 1, blocked: 1, published: 1 });
  assert.deepEqual(rowIds(results.rows.filter(isReadyForAllocation)), [
    "cohort",
    "transfer",
    "entry",
  ]);
});

void it("distinguishes falling below the minimum from a significant loss of students", () => {
  const board = reviewBoard([]);
  board.semester.formationRiskLimit = 6;
  const plan = {
    ...reviewPlan,
    previousStudentCount: 8,
    enrolledStudentIds: ["1", "2", "3", "4", "5", "6"],
  };
  assert.equal(atRisk(board, plan), false);
  assert.equal(significantReduction(board, plan), false);
  assert.equal(significantReduction(board, { ...plan, previousStudentCount: 9 }), true);
  assert.equal(atRisk(board, { ...plan, enrolledStudentIds: ["1", "2", "3", "4", "5"] }), true);
});

void it("includes classes at risk only when their own filter is selected", () => {
  const board = reviewBoard([
    placement("at-risk", { planId: "class-10", confirmation: "PENDING" }),
    placement("significant-reduction", { confirmation: "PENDING" }),
  ]);
  board.semester.formationRiskLimit = 6;
  board.plans = [
    {
      ...reviewPlan,
      id: "class-10",
      previousStudentCount: 9,
      enrolledStudentIds: ["1", "2", "3", "4", "5"],
    },
    {
      ...reviewPlan,
      id: "class-2",
      previousStudentCount: 9,
      enrolledStudentIds: ["1", "2", "3", "4", "5", "6"],
    },
  ];

  const reduction = { ...criteria, reducaoSignificativa: true };
  assert.deepEqual(rowIds(reviewResults(board, { criteria: reduction, scope: "all" }).rows), [
    "significant-reduction",
  ]);
  assert.deepEqual(
    rowIds(
      reviewResults(board, { criteria: { ...criteria, turmasEmRisco: true }, scope: "all" }).rows,
    ),
    ["at-risk"],
  );
  assert.deepEqual(
    rowIds(
      reviewResults(board, { criteria: { ...reduction, turmasEmRisco: true }, scope: "all" }).rows,
    ),
    ["at-risk", "significant-reduction"],
  );
});

void it("uses attention reasons within blocked continuity and ignores stale reasons for preconfirmed students", () => {
  const board = reviewBoard([
    placement("risk", { confirmation: "BLOCKED", continuity: "LEAVING" }),
    placement("other", { confirmation: "BLOCKED" }),
    placement("ready", { confirmation: "PRECONFIRMED" }),
  ]);
  const filter = { ...criteria, atencaoVinculo: "leaving" };
  assert.deepEqual(rowIds(reviewResults(board, { criteria: filter, scope: "blocked" }).rows), [
    "risk",
  ]);
  assert.deepEqual(rowIds(reviewResults(board, { criteria: filter, scope: "ready" }).rows), [
    "ready",
  ]);
});
