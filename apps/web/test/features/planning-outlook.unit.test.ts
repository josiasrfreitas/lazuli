import assert from "node:assert/strict";
import { it } from "node:test";
import { semesterOutlook } from "../../src/features/stage-planning/outlook-model.js";
type Input = Parameters<typeof semesterOutlook>[0];
function scenario(completed: number): Input {
  const items = Array.from({ length: 40 }, (_, i) => ({
    id: String(i + 1),
    plannedOn: `2026-11-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
    title: `Conteúdo ${i + 1}`,
    reference: null,
    kind: "CONTENT" as const,
    pageFrom: null,
    pageTo: null,
    programActivityId: String(i + 1),
    curriculum: {
      title: `Conteúdo ${i + 1}`,
      sequence: i + 1,
      durationMinutes: 60,
      unit: { id: "u", sequence: 1, title: "Unidade 1" },
      lessons: [],
    },
  }));
  return {
    plan: { items },
    scope: { today: "2026-11-15" },
    calendar: { availableMinutes: 840, remainingSessions: 7, unrecordedSessions: 0 },
    records: [
      {
        id: "r",
        classId: "c",
        date: "2026-11-15",
        time: "10:00",
        content: {
          kind: "CONTENT",
          account: "Conteúdo trabalhado.",
          reference: null,
          pageFrom: null,
          pageTo: null,
          planItems: items.slice(0, completed).map((i) => ({ id: i.id, status: "COMPLETED" })),
        },
      },
    ],
  };
}
void it("distinguishes margin, no margin and a shortfall by curriculum duration", () => {
  for (const [done, status, remaining, margin] of [
    [36, "margin", 240, 600],
    [26, "tight", 840, 0],
    [14, "shortfall", 1560, -720],
  ] as const) {
    const result = semesterOutlook(scenario(done));
    assert.equal(result.status, status);
    assert.equal(result.remainingMinutes, remaining);
    assert.equal(result.margin, margin);
  }
});
void it("does not equate missing past evidence with a definite workload forecast", () => {
  const data = scenario(36);
  data.records[0]!.content.planItems = data.records[0]!.content.planItems!.slice(-1);
  assert.equal(semesterOutlook(data).status, "unknown");
  const missing = scenario(26);
  missing.calendar.unrecordedSessions = 1;
  assert.equal(semesterOutlook(missing).status, "unknown");
});
void it("keeps partial completion conservative instead of inventing half progress", () => {
  const data = scenario(26);
  data.records[0]!.content.planItems!.at(-1)!.status = "PARTIAL";
  const result = semesterOutlook(data);
  assert.equal(result.status, "partial");
  assert.equal(result.partialMinutes, 60);
  assert.equal(result.remainingMinutes, 900);
});
void it("requires known duration and handles a completed program with no remaining sessions", () => {
  const data = scenario(40);
  data.calendar.availableMinutes = 0;
  data.calendar.remainingSessions = 0;
  assert.equal(semesterOutlook(data).status, "complete");
  data.plan!.items[0]!.curriculum = null;
  assert.equal(semesterOutlook(data).status, "unknown");
});
void it("shows an initial curriculum deficit without inventing dates for unscheduled content", () => {
  const data = scenario(0);
  data.preview = {
    plannedStartOn: "2026-11-16",
    items: data.plan!.items.map((item) => ({ ...item, plannedOn: null })),
  };
  data.plan = null;
  data.records = [];
  data.calendar.availableMinutes = 120;
  data.calendar.remainingSessions = 1;
  const result = semesterOutlook(data);
  assert.equal(result.status, "shortfall");
  assert.equal(result.remainingMinutes, 2400);
  assert.equal(result.margin, -2280);
  assert.equal(result.journey.expected, undefined);
  assert.equal(result.journey.next?.item.plannedOn, null);
  assert.equal(result.journey.steps.length, 40);
});
