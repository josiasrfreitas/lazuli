import assert from "node:assert/strict";
import test from "node:test";

import { filterIdsFromUrl } from "../../src/features/students/logic.js";

void test("shared student filter URLs keep unique valid identifiers within the server limit", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(filterIdsFromUrl(`${first},invalid,${first},${second}`), [first, second]);
  assert.equal(
    filterIdsFromUrl(
      Array.from(
        { length: 60 },
        (_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      ).join(","),
    ).length,
    50,
  );
});
