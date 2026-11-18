import assert from "node:assert/strict";
import { it } from "node:test";
import type { Period, SchoolClosedDay } from "@lazuli/db/prisma";
import { selectImpactCandidates } from "../../src/calendar/impact-selection.js";
import type { CalendarChangeState } from "../../src/calendar/change-state.js";
import type { ImpactPlan, ImpactRows } from "../../src/calendar/impact-read.js";

const timestamp = new Date("2026-01-01T00:00:00Z");
const period: Period = {
  formationRiskLimit: 4,
  id: "impact-period",
  name: "2026.2",
  startDate: new Date("2026-07-01"),
  endDate: new Date("2026-11-30"),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
function planned(date: string): ImpactPlan {
  return {
    id: date,
    plannedOn: new Date(date),
    planId: "impact-plan",
    plannedSessionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    kind: "ACTIVITY",
    title: "Atividade planejada",
    reference: null,
    pageFrom: null,
    pageTo: null,
    programActivityId: null,
    plan: {
      classId: "impact-class",
      class: { portalClassName: "Turma", semesterId: period.id },
      student: null,
    },
  };
}
function rows(dates: string[]): ImpactRows {
  return { sessions: [], appointments: [], visits: [], plannedItems: dates.map(planned) };
}
function state(): CalendarChangeState {
  return {
    periods: [period],
    period,
    interruptions: [],
    interruption: undefined,
    closedDays: [],
    proposedPeriods: [period],
    closed: new Set(),
    from: "2026-07-01",
    through: "2026-11-30",
  };
}

void it("reports newly excluded planning dates without counting already-invalid dates or unchanged closures", () => {
  const current = state();
  current.proposedPeriods = [{ ...period, endDate: new Date("2026-10-30") }];
  current.closed = new Set(["2026-09-07"]);
  current.closedDays = [
    {
      id: "unchanged-closure",
      date: new Date("2026-09-07"),
      calendarManaged: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      reason: "Feriado",
      createdById: null,
    } satisfies SchoolClosedDay,
  ];
  const result = selectImpactCandidates(
    rows(["2026-06-30", "2026-09-07", "2026-11-21", "2026-12-01"]),
    {
      state: current,
      now: timestamp,
      change: {
        action: "period",
        id: period.id,
        expectedUpdatedAt: timestamp.toISOString(),
        name: period.name,
        from: "2026-07-01",
        through: "2026-10-30",
      },
    },
  );
  assert.deepEqual(
    result.plans.map((row) => row.id),
    ["2026-11-21"],
  );
});

void it("includes a newly closed day while ignoring an existing closure between selected dates", () => {
  const current = state();
  current.closed = new Set(["2026-11-20", "2026-11-21"]);
  current.closedDays = [
    {
      id: "existing-closure",
      date: new Date("2026-11-20"),
      calendarManaged: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      reason: "Feriado",
      createdById: null,
    },
  ];
  const result = selectImpactCandidates(rows(["2026-11-20", "2026-11-21"]), {
    state: current,
    now: timestamp,
    change: {
      action: "interruption",
      kind: "RECESS",
      title: "Novo fechamento",
      description: null,
      from: "2026-11-21",
      through: "2026-11-21",
    },
  });
  assert.deepEqual(
    result.plans.map((row) => row.id),
    ["2026-11-21"],
  );
});
