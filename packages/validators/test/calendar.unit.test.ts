import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSemesterInputSchema } from "../src/calendar.js";

const SEMESTER_START = "2026-08-01";

void describe("semester input", () => {
  void it("rejects an end date before the start date", () => {
    const result = createSemesterInputSchema.safeParse({
      name: "2026.2",
      startDate: SEMESTER_START,
      endDate: "2026-07-31",
    });

    assert.deepEqual(result.error?.issues, [
      {
        code: "custom",
        message: "Data inicial deve ser anterior ou igual a data final.",
        path: ["endDate"],
      },
    ]);
  });

  void it("accepts a semester that starts and ends on the same date", () => {
    const result = createSemesterInputSchema.safeParse({
      name: "Intensivo",
      startDate: SEMESTER_START,
      endDate: SEMESTER_START,
    });

    assert.equal(result.success, true);
  });
});
