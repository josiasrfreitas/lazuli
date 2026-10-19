import assert from "node:assert/strict";
import { test } from "node:test";
import type { CSSProperties } from "react";
import {
  gridBehavior,
  type SurfaceLayout,
  type SurfaceProps,
} from "../../src/components/schedule-calendar/surface-model.js";
import {
  dailyBlocks,
  weeklyBlocks,
  revealWeeklyBlocks,
  expandedWeeklyBlock,
} from "../../src/components/schedule-calendar/weekly-blocks.js";

const events = ["Ana", "Bruno", "Carla"].map((title) => ({
  id: title,
  title,
  date: "2026-10-16",
  startTime: "14:00",
  endTime: "15:00",
}));
const blocks = dailyBlocks(events, "2026-10-16");
const props: SurfaceProps = {
  date: "2026-10-16",
  view: "day",
  events,
  onDateChange: () => {},
  onViewChange: () => {},
  onSelectRange: () => {},
  onRejected: () => {},
};
function layout(activeId: string | null): SurfaceLayout {
  return {
    activeId,
    expandedId: activeId,
    displayed: blocks,
    timelineRef: { current: null },
    expand: () => {},
    hover: { expand: () => {}, onPointerMove: () => {}, onPointerLeave: () => {} },
  };
}
function geometry(view: SurfaceProps["view"], activeId: string | null): CSSProperties[] {
  const algorithm = gridBehavior({ ...props, view }, layout(activeId)).dayLayoutAlgorithm;
  assert.equal(typeof algorithm, "function");
  if (typeof algorithm !== "function") throw new Error("Expected calendar layout function");
  return algorithm({
    events: blocks,
    minimumStartDifference: 0,
    accessors: {},
    slotMetrics: { getRange: () => ({ top: 25, height: 10 }) },
  }).map(({ style }) => style);
}

void test("daily concurrent lanes keep equal widths when a detail panel is active", () => {
  const resting = geometry("day", null);
  const active = geometry("day", blocks[1]!.id);
  assert.deepEqual(active, resting);
  assert.deepEqual(
    active.map((style) => Number.parseFloat(String(style.width).replace("calc(", "")).toFixed(4)),
    ["33.3333", "33.3333", "33.3333"],
  );
});

void test("weekly selection still allocates more horizontal room to the active event", () => {
  const resting = geometry("week", null);
  const active = geometry("week", blocks[1]!.id);
  assert.notDeepEqual(active, resting);
  assert.deepEqual(
    active.map((style) => Number.parseFloat(String(style.width).replace("calc(", "")).toFixed(4)),
    ["14.2857", "71.4286", "14.2857"],
  );
  assert.deepEqual(
    active.map(({ top, height }) => [top, height]),
    resting.map(({ top, height }) => [top, height]),
  );
});

void test("clicking More 2 expands the day and all six concurrent events after replacing the overflow", () => {
  const concurrent = [
    ...events,
    ...["Dora", "Eva", "Fabio"].map((title) => ({ ...events[0]!, id: title, title })),
  ];
  const resting = weeklyBlocks(concurrent, props.date);
  const overflow = resting.find((block) => block.kind === "overflow")!;
  assert.equal(overflow.lessons.length, 2);
  const displayed = revealWeeklyBlocks(resting, overflow.groupId);
  const active = expandedWeeklyBlock(displayed, overflow.id);
  assert.equal(active?.date, "2026-10-16");
  const behavior = gridBehavior({ ...props, view: "week" }, { ...layout(active.id), displayed });
  assert.equal(
    behavior.dayPropGetter?.(new Date(2026, 9, 16)).className,
    "lz-calendar-expanded-day",
  );
  assert.deepEqual(
    displayed.map((block) => block.lessons[0]!.id),
    ["Ana", "Bruno", "Carla", "Dora", "Eva", "Fabio"],
  );
  assert.deepEqual(
    displayed.map((block) => [block.kind, block.revealed, block.columns]),
    Array.from({ length: 6 }, () => ["lesson", true, 6]),
  );
});
