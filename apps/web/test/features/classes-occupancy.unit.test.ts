import assert from "node:assert/strict";
import test from "node:test";
import { classOccupancyIndicator } from "../../src/features/classes/labels.js";

void test("uses default thresholds when no class capacity is supplied: red from 20 through 25 and purple above 25", () => {
  for (const [occupancy, variant, label] of [
    [0, "success", "Ocupação tranquila"],
    [19, "success", "Ocupação tranquila"],
    [20, "destructive", "Ocupação alta"],
    [24, "destructive", "Ocupação alta"],
    [25, "destructive", "Ocupação alta"],
    [26, "over-capacity", "Acima da capacidade"],
    [40, "over-capacity", "Acima da capacidade"],
  ] as const) {
    assert.deepEqual(classOccupancyIndicator(occupancy), { variant, label });
  }
});

void test("uses each class capacity for high and over-capacity indicators", () => {
  assert.equal(classOccupancyIndicator(7, 10).variant, "success");
  assert.equal(classOccupancyIndicator(8, 10).variant, "destructive");
  assert.equal(classOccupancyIndicator(11, 10).variant, "over-capacity");
  assert.equal(classOccupancyIndicator(20, 30).variant, "success");
});
