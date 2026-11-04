import assert from "node:assert/strict";
import { it } from "node:test";

import { saoPauloDateOnly } from "../src/session-time.js";

void it("reuses the date formatter while recalculating each instant across calendar boundaries", (context) => {
  const original = Intl.DateTimeFormat;
  let constructions = 0;
  Intl.DateTimeFormat = new Proxy(original, {
    construct(target, args) {
      constructions += 1;
      return Reflect.construct(target, args);
    },
  });
  context.after(() => {
    Intl.DateTimeFormat = original;
  });
  const cases = [
    ["2027-01-01T02:59:59.999Z", "2026-12-31"],
    ["2027-01-01T03:00:00.000Z", "2027-01-01"],
    ["2024-03-01T02:59:59.999Z", "2024-02-29"],
    ["2024-03-01T03:00:00.000Z", "2024-03-01"],
    ["2004-02-15T01:30:00.000Z", "2004-02-14"],
    ["2004-02-15T03:00:00.000Z", "2004-02-15"],
  ] as const;

  for (let repetition = 0; repetition < 10; repetition += 1) {
    for (const [instant, expected] of cases) {
      assert.equal(saoPauloDateOnly(new Date(instant)), expected, instant);
    }
  }
  assert.ok(
    constructions <= 1,
    `Expected formatter reuse; constructed ${constructions} formatters`,
  );
});
