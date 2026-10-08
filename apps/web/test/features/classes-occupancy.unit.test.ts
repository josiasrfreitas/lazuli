import assert from "node:assert/strict";
import test from "node:test";
import { classOccupancyIndicator } from "../../src/features/classes/labels.js";

void test("uses the school-wide thresholds: red from 20 through 25 and purple above 25", () => {
  for (const [occupancy, variant, label] of [
    [0, "success", "Ocupação tranquila"],
    [19, "success", "Ocupação tranquila"],
    [20, "destructive", "Ocupação alta"],
    [24, "destructive", "Ocupação alta"],
    [25, "destructive", "Ocupação alta"],
    [26, "over-capacity", "Acima da referência"],
    [40, "over-capacity", "Acima da referência"],
  ] as const) {
    assert.deepEqual(classOccupancyIndicator(occupancy), { variant, label });
  }
});
