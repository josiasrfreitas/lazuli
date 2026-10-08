import assert from "node:assert/strict";
import test from "node:test";
import { classOccupancyIndicator } from "../../src/features/classes/labels.js";

void test("colors occupancy by its proximity to the reference capacity", () => {
  for (const [occupancy, variant, label] of [
    [0, "success", "Ocupação baixa"],
    [3, "success", "Ocupação baixa"],
    [14, "success", "Ocupação baixa"],
    [15, "warning", "Ocupação moderada"],
    [19, "warning", "Ocupação moderada"],
    [20, "destructive", "Ocupação alta"],
    [21, "destructive", "Ocupação alta"],
  ] as const) {
    assert.deepEqual(classOccupancyIndicator(occupancy, 20), { variant, label });
  }
  assert.deepEqual(classOccupancyIndicator(15, 30), {
    variant: "success",
    label: "Ocupação baixa",
  });
});
