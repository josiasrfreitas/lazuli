import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WeeklyHover,
  type WeeklyHoverSample,
} from "../../src/components/schedule-calendar/weekly-hover.js";

const sample: WeeklyHoverSample = {
  groupId: "afternoon",
  left: 100,
  width: 600,
  columns: 6,
  clientX: 150,
  clientY: 50,
  lanes: [{ id: "first", lane: 0, left: 100, right: 200, top: 0, bottom: 100 }],
};

void test("vertical gaps keep the expanded day open and cancel a pending close", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  hover.move(sample);
  hover.leave();
  context.mock.timers.tick(200);
  hover.move({ ...sample, clientY: 400 });
  context.mock.timers.tick(500);
  assert.deepEqual(selected, ["first"]);
  hover.leave();
  context.mock.timers.tick(254);
  assert.deepEqual(selected, ["first"]);
  context.mock.timers.tick(1);
  assert.deepEqual(selected, ["first", null]);
  hover.reset();
});

void test("a clicked overflow stays open above and below its cards until exiting the day", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  hover.move({ ...sample, revealed: true, clientY: 400 });
  context.mock.timers.tick(500);
  hover.move({ ...sample, revealed: true, clientY: -100 });
  context.mock.timers.tick(500);
  assert.deepEqual(selected, []);
  hover.leave();
  context.mock.timers.tick(255);
  assert.deepEqual(selected, [null]);
  hover.reset();
});

void test("the expanded visible card remains the target when old hit zones drift underneath it", () => {
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  const initial = {
    ...sample,
    width: 400,
    columns: 4,
    clientX: 120,
    lanes: ["Ana", "Bia", "Caio", "Davi"].map((id, lane) => ({
      id,
      lane,
      top: 0,
      bottom: 100,
      left: 100 + lane * 100,
      right: 200 + lane * 100,
    })),
  };
  hover.move(initial);
  const expanded = {
    ...initial,
    left: 20,
    width: 900,
    lanes: [
      { ...initial.lanes[0]!, left: 20, right: 582.5 },
      { ...initial.lanes[1]!, left: 582.5, right: 695 },
      { ...initial.lanes[2]!, left: 695, right: 807.5 },
      { ...initial.lanes[3]!, left: 807.5, right: 920 },
    ],
  };
  hover.move({ ...expanded, clientX: 235 });
  hover.move({ ...expanded, clientX: 400 });
  hover.move({ ...expanded, clientX: 600 });
  assert.deepEqual(selected, ["Ana", "Ana", "Ana", "Bia"]);
  hover.reset();
});

for (const columns of [4, 5, 12, 40]) {
  void test(`${columns} dense lanes remain individually reachable in both directions`, () => {
    const selected: (string | null)[] = [];
    const hover = new WeeklyHover((id) => selected.push(id));
    const lanes = Array.from({ length: columns }, (_value, lane) => ({
      id: `lesson-${lane}`,
      lane,
      left: 100 + lane * 12,
      right: 111 + lane * 12,
      top: 0,
      bottom: 100,
    }));
    const sequence = [...lanes, ...lanes.toReversed()];
    for (const target of sequence) {
      hover.move({ ...sample, width: columns * 12, columns, lanes, clientX: target.left + 1 });
    }
    assert.deepEqual(
      selected,
      sequence.map((lane) => lane.id),
      `${columns} dense lanes`,
    );
    hover.reset();
  });
}

void test("reversing direction follows the current rendered boundaries after resizing", () => {
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  const lanes = [
    { id: "Ana", lane: 0, left: 100, right: 150, top: 0, bottom: 100 },
    { id: "Bia", lane: 1, left: 150, right: 200, top: 0, bottom: 100 },
    { id: "Caio", lane: 2, left: 200, right: 500, top: 0, bottom: 100 },
  ];
  hover.move({ ...sample, columns: 3, lanes, clientX: 450 });
  hover.move({ ...sample, columns: 3, lanes, clientX: 201 });
  hover.move({ ...sample, columns: 3, lanes, clientX: 199 });
  hover.move({ ...sample, columns: 3, lanes, clientX: 151 });
  hover.move({ ...sample, columns: 3, lanes, clientX: 149 });
  assert.deepEqual(selected, ["Caio", "Caio", "Bia", "Bia", "Ana"]);
  hover.reset();
});

void test("revealed overflow keeps every lesson open while traversing a very dense group", () => {
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  const lanes = Array.from({ length: 40 }, (_value, lane) => ({
    id: `lesson-${lane}`,
    lane,
    left: 100 + lane * 12,
    right: 111 + lane * 12,
    top: 0,
    bottom: 100,
  }));
  for (const target of lanes) {
    hover.move({ ...sample, lanes, revealed: true, clientX: target.left + 1 });
  }
  assert.deepEqual(selected, []);
  hover.reset();
});

void test("the browser's hit target wins when animated rectangles overlap", () => {
  const selected: (string | null)[] = [];
  const hover = new WeeklyHover((id) => selected.push(id));
  hover.move({
    ...sample,
    clientX: 180,
    targetId: "Bia",
    lanes: [
      { id: "Ana", lane: 0, left: 100, right: 250, top: 0, bottom: 100 },
      { id: "Bia", lane: 1, left: 160, right: 350, top: 0, bottom: 100 },
    ],
  });
  assert.deepEqual(selected, ["Bia"]);
  hover.reset();
});
