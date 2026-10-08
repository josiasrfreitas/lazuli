import assert from "node:assert/strict";
import test from "node:test";
import { classOccupancyIndicator } from "../../src/features/classes/labels.js";

void test("colors occupancy by its proximity to the reference capacity", () => {
  for (const [occupancy, variant, label] of [
    [0, "success", "Ocupação baixa"],
    [4, "success", "Ocupação baixa"],
    [5, "warning", "Ocupação moderada"],
    [7, "warning", "Ocupação moderada"],
    [8, "destructive", "Ocupação alta"],
    [10, "destructive", "Ocupação alta"],
    [12, "destructive", "Ocupação alta"],
  ] as const) {
    assert.deepEqual(classOccupancyIndicator(occupancy, 10), { variant, label });
  }
  assert.deepEqual(classOccupancyIndicator(10, 20), {
    variant: "warning",
    label: "Ocupação moderada",
  });
});
