import assert from "node:assert/strict";
import { it } from "node:test";
import { contentChoicesForUnit } from "../../src/features/stage-planning/journey-model.js";

void it("limits content choices to the selected unit even when lesson titles repeat", () => {
  const groups = [
    { id: "first-intro", unit: "Unidade 1", title: "Introdução" },
    { id: "second-intro", unit: "Unidade 2", title: "Introdução" },
    { id: "first-review", unit: "Unidade 1", title: "Revisão" },
  ];
  assert.deepEqual(contentChoicesForUnit(groups, "Unidade 1"), [
    { value: "first-intro", label: "Introdução" },
    { value: "first-review", label: "Revisão" },
  ]);
  assert.deepEqual(contentChoicesForUnit(groups, "Unidade 2"), [
    { value: "second-intro", label: "Introdução" },
  ]);
  assert.deepEqual(contentChoicesForUnit(groups, "Unidade 3"), []);
});
