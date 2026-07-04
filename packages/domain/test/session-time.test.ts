import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionEndInstant } from "../src/session-time.js";

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
