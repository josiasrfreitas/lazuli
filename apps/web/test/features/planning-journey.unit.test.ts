import assert from "node:assert/strict";
import { it } from "node:test";
import {
  planningJourney,
  type JourneyRecord,
} from "../../src/features/stage-planning/journey-model.js";
const items = Array.from({ length: 40 }, (_value, index) => ({
  id: String(index + 1),
  title: `Step ${index + 1}`,
  reference: null,
  plannedOn: `2026-11-${String(Math.floor(index / 2) + 1).padStart(2, "0")}`,
}));
function record(
  step: string | null,
  {
    status = "COMPLETED",
    date = "2026-11-15",
  }: { status?: "PARTIAL" | "COMPLETED"; date?: string } = {},
): JourneyRecord {
  return {
    id: `${step}-${date}`,
    date,
    time: "10:00",
    content: { planItemId: step, planItemStatus: status },
  };
}
void it("compares the three scenarios by planned encounters without inferring completion", () => {
  for (const [step, distance] of [
    ["36", 3],
    ["26", -2],
    ["14", -8],
  ] as const) {
    const journey = planningJourney(items, { records: [record(step)], today: "2026-11-15" });
    assert.equal(journey.difference, distance);
    assert.equal(journey.expected?.number, 30);
    assert.equal(journey.completed, 1);
    assert.equal(journey.steps[0]?.state, "unconfirmed");
    assert.equal(journey.next?.number, Number(step) + 1);
  }
});
void it("continues a partial step rather than advancing automatically", () => {
  const journey = planningJourney(items, {
    records: [record("14", { status: "PARTIAL" })],
    today: "2026-11-15",
  });
  assert.equal(journey.current?.state, "partial");
  assert.equal(journey.next?.number, 14);
  assert.equal(journey.completed, 0);
});
void it("retains completed evidence when a later lesson revisits a step", () => {
  const journey = planningJourney(items, {
    records: [
      record("14", { status: "PARTIAL" }),
      record("14", { status: "COMPLETED", date: "2026-11-14" }),
    ],
    today: "2026-11-15",
  });
  assert.equal(journey.completed, 1);
  assert.equal(journey.current?.evidence.length, 2);
  assert.equal(journey.next?.number, 15);
});
void it("keeps unlinked and removed-step records visible without using them as position", () => {
  const records = [
    record(null),
    record("removed"),
    record("12", { status: "COMPLETED", date: "2026-11-14" }),
  ];
  const journey = planningJourney(items, { records: records, today: "2026-11-15" });
  assert.equal(journey.unlinked.length, 2);
  assert.equal(journey.recent.length, 3);
  assert.equal(journey.current?.number, 12);
  assert.equal(journey.latestLinked?.date, "2026-11-14");
});
void it("does not convert legacy evidence without status into a completion", () => {
  const historyRecord = { ...record("14"), content: { planItemId: "14" } };
  const journey = planningJourney(items, { records: [historyRecord], today: "2026-11-15" });
  assert.equal(journey.current?.state, "worked");
  assert.equal(journey.completed, 0);
  assert.equal(journey.next?.number, 14);
});
void it("handles no records, pre-start, empty and completed programs", () => {
  const before = planningJourney(items, { records: [], today: "2026-10-01" });
  assert.equal(before.difference, null);
  assert.equal(before.expected, undefined);
  assert.equal(before.next?.number, 1);
  assert.equal(before.steps[0]?.state, "scheduled");
  assert.equal(planningJourney([], { records: [], today: "2026-11-15" }).groups.length, 0);
  const done = planningJourney(items, {
    records: items.map((index) => record(index.id, { status: "COMPLETED", date: index.plannedOn })),
    today: "2026-11-21",
  });
  assert.equal(done.completed, 40);
  assert.equal(done.next, undefined);
});
void it("records all activities in a single session and gives each its own status", () => {
  const historyRecord = {
    ...record("4"),
    content: {
      planItemId: "4",
      planItems: [
        { id: "1", status: "COMPLETED" as const },
        { id: "2", status: "COMPLETED" as const },
        { id: "3", status: "COMPLETED" as const },
        { id: "4", status: "PARTIAL" as const },
      ],
    },
  };
  const journey = planningJourney(items, { records: [historyRecord], today: "2026-11-15" });
  assert.equal(journey.completed, 3);
  assert.equal(journey.current?.number, 4);
  assert.equal(journey.next?.number, 4);
  assert.equal(journey.steps[0]?.evidence[0]?.content.planItemStatus, "COMPLETED");
  assert.equal(journey.steps[3]?.state, "partial");
});
void it("an explicit empty list clears legacy coverage", () => {
  const journey = planningJourney(items, {
    records: [{ ...record("4"), content: { planItemId: "4", planItems: [] } }],
    today: "2026-11-15",
  });
  assert.equal(journey.completed, 0);
  assert.equal(journey.current, undefined);
});
