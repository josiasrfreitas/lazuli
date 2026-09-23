import assert from "node:assert/strict";
import test from "node:test";

import type { RemoteOptionsResult } from "@lazuli/ui";

import { studentFilterOptionResult } from "../../src/features/students/filter-options.js";

void test("empty search does not show remote options", () => {
  const options = Array.from({ length: 25 }, (_value, index) => ({
    id: String(index),
    label: `Turma ${index + 1}`,
  }));
  const result = studentFilterOptionResult("", {
    data: options,
    isError: false,
    isFetching: false,
    refetch: () => {},
  });

  assert.deepEqual(result, { status: "idle", query: "" });
});

void test("typed search narrows the preview to matching labels", () => {
  const result = studentFilterOptionResult("B2", {
    data: [
      { id: "a", label: "Turma A1" },
      { id: "b", label: "Turma B2" },
    ],
    isError: false,
    isFetching: false,
    refetch: () => {},
  });

  const ready = result as Extract<RemoteOptionsResult, { status: "ready" }>;
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.options, [{ id: "b", label: "Turma B2" }]);
  assert.equal(ready.hasMore, false);
});
