import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSessionUntaken } from "../src/session-status.js";

// Session ends 2026-03-10 16:30 in America/Sao_Paulo === 2026-03-10T19:30:00Z.
const AFTER_END = new Date("2026-03-10T20:00:00.000Z");
const BEFORE_END = new Date("2026-03-10T18:00:00.000Z");

type UntakenInput = Parameters<typeof isSessionUntaken>[0];

const BASE: UntakenInput = {
  status: "SCHEDULED",
  date: "2026-03-10",
  endTime: "16:30",
  attendanceConfirmedAt: null,
  now: AFTER_END,
};

const untaken = (overrides: Partial<UntakenInput>): boolean =>
  isSessionUntaken({ ...BASE, ...overrides });

void describe("isSessionUntaken", () => {
  void it("flags a scheduled session whose end passed with no confirmation", () => {
    assert.equal(untaken({}), true);
  });

  void it("does not flag a confirmed session", () => {
    assert.equal(untaken({ attendanceConfirmedAt: new Date("2026-03-10T19:45:00.000Z") }), false);
  });

  void it("does not flag a cancelled session", () => {
    assert.equal(untaken({ status: "CANCELLED" }), false);
  });

  void it("does not flag before the session end instant", () => {
    assert.equal(untaken({ now: BEFORE_END }), false);
  });

  void it("accepts Prisma date and time values", () => {
    assert.equal(
      untaken({
        date: new Date("2026-03-10T00:00:00.000Z"),
        endTime: new Date("1970-01-01T16:30:00.000Z"),
      }),
      true,
    );
  });
});
