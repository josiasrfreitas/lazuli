import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAtLeastTomorrowInSaoPaulo,
  saoPauloDateOnly,
  sessionEndInstant,
} from "../src/session-time.js";

void describe("sessionEndInstant", () => {
  void it("converts a Sao Paulo session end wall time to a UTC instant", () => {
    const instant = sessionEndInstant({
      date: "2026-03-10",
      endTime: "16:30",
    });

    assert.equal(instant.toISOString(), "2026-03-10T19:30:00.000Z");
  });

  void it("accepts Prisma date and time values", () => {
    const instant = sessionEndInstant({
      date: new Date("2026-03-10T00:00:00.000Z"),
      endTime: new Date("1970-01-01T10:00:00.000Z"),
    });

    assert.equal(instant.toISOString(), "2026-03-10T13:00:00.000Z");
  });
});

// Brazil has no DST since 2019, so America/Sao_Paulo is a fixed UTC-3 for these instants.
// 12:00Z is midday in SP on 2026-03-12; 02:00Z is still 2026-03-11 (23:00) in SP.
const MIDDAY_UTC = new Date("2026-03-12T12:00:00.000Z");
const LATE_UTC_PRIOR_SP_DAY = new Date("2026-03-12T02:00:00.000Z");
const MIDDAY_SP_DAY = "2026-03-12";

void describe("saoPauloDateOnly", () => {
  void it("returns the SP wall-clock day for a midday instant", () => {
    assert.equal(saoPauloDateOnly(MIDDAY_UTC), MIDDAY_SP_DAY);
  });

  void it("rolls back to the prior SP day for a late-UTC instant still on the previous local day", () => {
    assert.equal(saoPauloDateOnly(LATE_UTC_PRIOR_SP_DAY), "2026-03-11");
  });

  void it("zero-pads month and day", () => {
    assert.equal(saoPauloDateOnly(new Date("2026-01-05T12:00:00.000Z")), "2026-01-05");
  });
});

void describe("isAtLeastTomorrowInSaoPaulo", () => {
  const now = MIDDAY_UTC; // SP day 2026-03-12

  void it("accepts a target strictly after the SP current day", () => {
    assert.equal(isAtLeastTomorrowInSaoPaulo({ targetDate: "2026-03-13", now }), true);
  });

  void it("rejects a target on the SP current day", () => {
    assert.equal(isAtLeastTomorrowInSaoPaulo({ targetDate: MIDDAY_SP_DAY, now }), false);
  });

  void it("rejects a target in the past", () => {
    assert.equal(isAtLeastTomorrowInSaoPaulo({ targetDate: "2026-03-11", now }), false);
  });

  void it("uses the SP current day, not the UTC day, for the boundary", () => {
    // now is still 2026-03-11 in SP, so MIDDAY_SP_DAY (2026-03-12) counts as tomorrow.
    assert.equal(
      isAtLeastTomorrowInSaoPaulo({ targetDate: MIDDAY_SP_DAY, now: LATE_UTC_PRIOR_SP_DAY }),
      true,
    );
  });

  void it("accepts a Date-typed target (Prisma @db.Date shape)", () => {
    const target = new Date("2026-03-20T00:00:00.000Z");
    assert.equal(isAtLeastTomorrowInSaoPaulo({ targetDate: target, now }), true);
  });
});
