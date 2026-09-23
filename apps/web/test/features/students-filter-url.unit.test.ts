import assert from "node:assert/strict";
import test from "node:test";

import { filterIdsFromUrl } from "../../src/features/students/logic.js";

const MANY_IDS = 60;
const SERVER_LIMIT = 50;
const UUID_TAIL_LENGTH = 12;

void test("shared student filter URLs keep unique valid identifiers within the server limit", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const manyIds: string[] = [];
  for (let index = 0; index < MANY_IDS; index++) {
    manyIds.push(`11111111-1111-4111-8111-${String(index).padStart(UUID_TAIL_LENGTH, "0")}`);
  }
  assert.deepEqual(filterIdsFromUrl(`${first},invalid,${first},${second}`), [first, second]);
  assert.equal(filterIdsFromUrl(manyIds.join(",")).length, SERVER_LIMIT);
});
