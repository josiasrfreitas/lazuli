import assert from "node:assert/strict";
import { it } from "node:test";
import {
  planningJourney,
  type JourneyRecord,
} from "../../src/features/stage-planning/journey-model.js";
const items = Array.from({ length: 40 }, (_, index) => ({
  id: String(index + 1),
  title: `Step ${index + 1}`,
  reference: null,
  plannedOn: `2026-11-${String(Math.floor(index / 2) + 1).padStart(2, "0")}`,
}));
function record(
  step: string | null,
  status: "PARTIAL" | "COMPLETED" = "COMPLETED",
  date = "2026-11-15",
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
    const j = planningJourney(items, [record(step)], "2026-11-15");
    assert.equal(j.difference, distance);
    assert.equal(j.expected?.number, 30);
    assert.equal(j.completed, 1);
    assert.equal(j.steps[0]?.state, "unconfirmed");
    assert.equal(j.next?.number, Number(step) + 1);
  }
});
void it("continues a partial step rather than advancing automatically", () => {
  const j = planningJourney(items, [record("14", "PARTIAL")], "2026-11-15");
  assert.equal(j.current?.state, "partial");
  assert.equal(j.next?.number, 14);
  assert.equal(j.completed, 0);
});
void it("retains completed evidence when a later lesson revisits a step", () => {
  const j = planningJourney(
    items,
    [record("14", "PARTIAL"), record("14", "COMPLETED", "2026-11-14")],
    "2026-11-15",
  );
  assert.equal(j.completed, 1);
  assert.equal(j.current?.evidence.length, 2);
  assert.equal(j.next?.number, 15);
});
void it("keeps unlinked and removed-step records visible without using them as position", () => {
  const records = [record(null), record("removed"), record("12", "COMPLETED", "2026-11-14")];
  const j = planningJourney(items, records, "2026-11-15");
  assert.equal(j.unlinked.length, 2);
  assert.equal(j.recent.length, 3);
  assert.equal(j.current?.number, 12);
  assert.equal(j.latestLinked?.date, "2026-11-14");
});
void it("does not convert legacy evidence without status into a completion", () => {
  const r = { ...record("14"), content: { planItemId: "14" } };
  const j = planningJourney(items, [r], "2026-11-15");
  assert.equal(j.current?.state, "worked");
  assert.equal(j.completed, 0);
  assert.equal(j.next?.number, 14);
});
void it("handles no records, pre-start, empty and completed programs", () => {
  const before = planningJourney(items, [], "2026-10-01");
  assert.equal(before.difference, null);
  assert.equal(before.expected, undefined);
  assert.equal(before.next?.number, 1);
  assert.equal(before.steps[0]?.state, "scheduled");
  assert.equal(planningJourney([], [], "2026-11-15").groups.length, 0);
  const done = planningJourney(
    items,
    items.map((i) => record(i.id, "COMPLETED", i.plannedOn)),
    "2026-11-21",
  );
  assert.equal(done.completed, 40);
  assert.equal(done.next, undefined);
});
void it("records all activities in a single session and gives each its own status", () => {
  const r = {
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
  const j = planningJourney(items, [r], "2026-11-15");
  assert.equal(j.completed, 3);
  assert.equal(j.current?.number, 4);
  assert.equal(j.next?.number, 4);
  assert.equal(j.steps[0]?.evidence[0]?.content.planItemStatus, "COMPLETED");
  assert.equal(j.steps[3]?.state, "partial");
});
void it("an explicit empty list clears legacy coverage", () => {
  const j = planningJourney(
    items,
    [{ ...record("4"), content: { planItemId: "4", planItems: [] } }],
    "2026-11-15",
  );
  assert.equal(j.completed, 0);
  assert.equal(j.current, undefined);
});
