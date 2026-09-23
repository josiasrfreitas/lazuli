import assert from "node:assert/strict";
import test from "node:test";

import type { RemoteOptionsResult } from "@lazuli/ui";

import { studentFilterOptionResult } from "../../src/features/students/filter-options.js";

const VISIBLE_OPTIONS = 20;

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

void test("remote options report loading and preserve the trimmed search", () => {
  const query = { data: undefined, isError: false, isFetching: true, refetch: () => {} };
  assert.deepEqual(studentFilterOptionResult("  Ana  ", query), {
    status: "loading",
    query: "Ana",
  });
  assert.deepEqual(studentFilterOptionResult("Ana", { ...query, data: [], isFetching: true }), {
    status: "loading",
    query: "Ana",
  });
});

void test("remote option errors expose a retry action", () => {
  let retries = 0;
  const result = studentFilterOptionResult("  Ana  ", {
    data: undefined,
    isError: true,
    isFetching: false,
    refetch: () => {
      retries += 1;
    },
  });
  assert.equal(result.status, "error");
  assert.equal(result.query, "Ana");
  if (result.status === "error") result.onRetry();
  assert.equal(retries, 1);
});

void test("remote options cap the preview and disclose more matches", () => {
  const options = Array.from({ length: 21 }, (_value, index) => ({
    id: String(index),
    label: `Turma A${index}`,
  }));
  const result = studentFilterOptionResult("a", {
    data: options,
    isError: false,
    isFetching: false,
    refetch: () => {},
  });
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.options.length, VISIBLE_OPTIONS);
    assert.equal(result.hasMore, true);
  }
});
