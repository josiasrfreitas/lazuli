import assert from "node:assert/strict";
import test from "node:test";

import { civilDateSchema } from "../src/civil-date.js";

void test("civil dates require exact YYYY-MM-DD shape and real calendar days", () => {
  assert.equal(civilDateSchema.safeParse("2024-02-29").success, true);
  for (const value of [
    "2024-02-30",
    "2023-02-29",
    "2024-13-01",
    "2024-00-01",
    "2024-01-00",
    "2024-01-1",
    "2024-1-01",
    "24-01-01",
    "2024-01-001",
    "x024-01-01",
    "2024-x1-01",
    "2024-01-x1",
    "2024-01-01x",
  ]) {
    assert.equal(civilDateSchema.safeParse(value).success, false, value);
  }
});
