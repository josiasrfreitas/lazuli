import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WeeklyHover,
  type WeeklyHoverSample,
} from "../../src/features/class-records/weekly-hover.js";

const group: WeeklyHoverSample = {
  groupId: "afternoon",
  left: 100,
  width: 400,
  columns: 4,
  clientX: 120,
  clientY: 50,
  lanes: [
    { id: "ana", lane: 0, top: 0, bottom: 100 },
    { id: "bia", lane: 1, top: 0, bottom: 100 },
    { id: "caio", lane: 2, top: 0, bottom: 100 },
    { id: "davi", lane: 3, top: 0, bottom: 100 },
  ],
};

void test("a continuous sweep visits each lesson immediately in both directions despite resizing", () => {
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  hover.move(group);
  // The day widens after entering, but the original 100px navigation zones stay put.
  for (const clientX of [220, 320, 420, 320, 220, 120])
    hover.move({ ...group, left: 20, width: 900, clientX });
  assert.deepEqual(selected, ["ana", "bia", "caio", "davi", "caio", "bia", "ana"]);
  hover.reset();
});

void test("a brief exit keeps the card open, reentry cancels closing, and a new exit gets its own grace period", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let selected: string | null = null;
  const hover = new WeeklyHover((id) => {
    selected = id;
  });
  hover.move(group);
  hover.leave();
  context.mock.timers.tick(250);
  assert.equal(selected, "ana");
  hover.move({ ...group, clientX: 220 });
  context.mock.timers.tick(100);
  assert.equal(selected, "bia");
  hover.leave();
  context.mock.timers.tick(299);
  assert.equal(selected, "bia");
  context.mock.timers.tick(1);
  assert.equal(selected, null);
  hover.reset();
});

void test("crossing into a different time group uses its own lanes and cancels the old close", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let selected: string | null = null;
  const hover = new WeeklyHover((id) => {
    selected = id;
  });
  hover.move(group);
  hover.leave();
  hover.move({ ...group, groupId: "evening", left: 500, width: 100, clientX: 585 });
  context.mock.timers.tick(400);
  assert.equal(selected, "davi");
  hover.reset();
});

void test("leaving the lesson's actual time interval closes it after grace; resetting cancels pending work", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let selected: string | null = null;
  const hover = new WeeklyHover((id) => {
    selected = id;
  });
  hover.move(group);
  hover.move({ ...group, clientY: 110 });
  context.mock.timers.tick(300);
  assert.equal(selected, null);
  hover.move(group);
  hover.leave();
  hover.reset();
  context.mock.timers.tick(400);
  assert.equal(selected, "ana");
});

void test("revealed overflow uses the visible equal lanes, including a longer lesson after its neighbors end", () => {
  let selected: string | null = null;
  const hover = new WeeklyHover((id) => {
    selected = id;
  });
  hover.move(group);
  hover.move({
    ...group,
    revealed: true,
    width: 800,
    clientX: 620,
    clientY: 120,
    lanes: group.lanes.map((item) => (item.id === "caio" ? { ...item, bottom: 150 } : item)),
  });
  assert.equal(selected, "caio");
  hover.reset();
});
