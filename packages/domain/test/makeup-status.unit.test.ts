import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveMakeupDisplayStatus } from "../src/makeup-status.js";

// Target session ends 2026-03-12 10:00 in America/Sao_Paulo === 2026-03-12T13:00:00Z.
const AFTER_END = new Date("2026-03-12T14:00:00.000Z");
const BEFORE_END = new Date("2026-03-12T09:00:00.000Z");

type MakeupInput = Parameters<typeof deriveMakeupDisplayStatus>[0];

const BASE: MakeupInput = {
  cancelledAt: null,
  targetSessionCancelled: false,
  attendedAt: null,
  targetSessionDate: "2026-03-12",
  targetSessionEndTime: "10:00",
  now: BEFORE_END,
};

const status = (overrides: Partial<MakeupInput>): string =>
  deriveMakeupDisplayStatus({ ...BASE, ...overrides });

void describe("deriveMakeupDisplayStatus", () => {
  void it("is SCHEDULED before the target session end with no outcome", () => {
    assert.equal(status({}), "SCHEDULED");
  });

  void it("is NO_SHOW after the target session end with no attendance", () => {
    assert.equal(status({ now: AFTER_END }), "NO_SHOW");
  });

  void it("is ATTENDED once attendance is marked", () => {
    assert.equal(
      status({ attendedAt: new Date("2026-03-12T13:05:00.000Z"), now: AFTER_END }),
      "ATTENDED",
    );
  });

  void it("is CANCELLED when the makeup row is cancelled", () => {
    assert.equal(status({ cancelledAt: new Date("2026-03-11T12:00:00.000Z") }), "CANCELLED");
  });

  void it("is CANCELLED when the target session is cancelled", () => {
    assert.equal(status({ targetSessionCancelled: true, now: AFTER_END }), "CANCELLED");
  });

  void it("prioritises CANCELLED over an attended outcome", () => {
    assert.equal(
      status({ cancelledAt: new Date("2026-03-11T12:00:00.000Z"), attendedAt: AFTER_END }),
      "CANCELLED",
    );
  });
});
