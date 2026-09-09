import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMinorInSaoPaulo, toDateOnlyString } from "../../src/students/date-rules.js";

const EIGHTEENTH_BIRTH_DATE = new Date("2026-04-15T00:00:00.000Z");
const BEFORE_EIGHTEENTH_BIRTHDAY_IN_SP = new Date("2044-04-15T02:59:59.999Z");
const START_OF_EIGHTEENTH_BIRTHDAY_IN_SP = new Date("2044-04-15T03:00:00.000Z");

void describe("isMinorInSaoPaulo", () => {
  void it("flips exactly at midnight on the 18th birthday in Sao Paulo", () => {
    assert.equal(
      isMinorInSaoPaulo({
        birthDate: EIGHTEENTH_BIRTH_DATE,
        now: BEFORE_EIGHTEENTH_BIRTHDAY_IN_SP,
      }),
      true,
    );
    assert.equal(
      isMinorInSaoPaulo({
        birthDate: EIGHTEENTH_BIRTH_DATE,
        now: START_OF_EIGHTEENTH_BIRTHDAY_IN_SP,
      }),
      false,
    );
  });

  void it("treats missing birth dates as adult", () => {
    assert.equal(
      isMinorInSaoPaulo({ birthDate: null, now: START_OF_EIGHTEENTH_BIRTHDAY_IN_SP }),
      false,
    );
    assert.equal(
      isMinorInSaoPaulo({ birthDate: undefined, now: START_OF_EIGHTEENTH_BIRTHDAY_IN_SP }),
      false,
    );
  });
});

void describe("toDateOnlyString", () => {
  void it("keeps only the date portion of a database date", () => {
    assert.equal(toDateOnlyString(EIGHTEENTH_BIRTH_DATE), "2026-04-15");
  });

  void it("keeps a missing database date as null", () => {
    assert.equal(toDateOnlyString(null), null);
  });
});
