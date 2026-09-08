import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { brazilFederalHolidaysForYear } from "../src/brazil-federal-holidays.js";

const REPRESENTATIVE_YEAR = 2026;

void describe("Brazil federal holidays", () => {
  void it("returns the nine fixed-date national holidays for the requested year", () => {
    const holidays = brazilFederalHolidaysForYear(REPRESENTATIVE_YEAR);

    assert.deepEqual(
      holidays.map((holiday) => holiday.date),
      [
        "2026-01-01",
        "2026-04-21",
        "2026-05-01",
        "2026-09-07",
        "2026-10-12",
        "2026-11-02",
        "2026-11-15",
        "2026-11-20",
        "2026-12-25",
      ],
    );
  });

  void it("excludes optional, religious, state, and municipal holidays", () => {
    const dates = new Set(
      brazilFederalHolidaysForYear(REPRESENTATIVE_YEAR).map((holiday) => holiday.date),
    );

    assert.equal(dates.has("2026-02-17"), false, "Carnaval is not imported");
    assert.equal(dates.has("2026-04-03"), false, "Sexta-feira Santa is not imported");
    assert.equal(dates.has("2026-06-04"), false, "Corpus Christi is not imported");
  });
});
