import assert from "node:assert/strict";
import { it } from "node:test";
import { planningPosition } from "../../src/features/stage-planning/progress-model.js";

void it("compares planned pages due today with the latest recorded position, never assuming past plans were performed", () => {
  const result = planningPosition(
    [
      { plannedOn: "2026-10-01", pageFrom: 1, pageTo: 10 },
      { plannedOn: "2026-10-18", pageFrom: 11, pageTo: 20 },
      { plannedOn: "2026-11-01", pageFrom: 21, pageTo: 40 },
    ],
    {
      records: [
        { date: "2026-10-10", time: "14:00", content: { pageFrom: 7, pageTo: 8 } },
        { date: "2026-10-17", time: "14:00", content: { pageFrom: 5, pageTo: 6 } },
        { date: "2026-10-18", time: "14:00", content: { pageFrom: null, pageTo: null } },
        { date: "2026-10-20", time: "14:00", content: { pageFrom: 30, pageTo: 32 } },
      ],
      today: "2026-10-18",
    },
  );
  assert.deepEqual(result, {
    expected: 20,
    actual: 6,
    lastDate: "2026-10-17",
    scale: 40,
    hasPlannedPages: true,
  });
});

void it("keeps missing evidence distinct from zero completion and supports advancement beyond the last planned page", () => {
  assert.deepEqual(planningPosition([], { records: [], today: "2026-10-18" }), {
    expected: null,
    actual: null,
    lastDate: null,
    scale: 1,
    hasPlannedPages: false,
  });
  assert.deepEqual(
    planningPosition([{ plannedOn: "2026-11-01", pageFrom: 10, pageTo: null }], {
      records: [{ date: "2026-10-17", time: "14:00", content: { pageFrom: 12, pageTo: 15 } }],
      today: "2026-10-18",
    }),
    { expected: null, actual: 15, lastDate: "2026-10-17", scale: 15, hasPlannedPages: true },
  );
});
