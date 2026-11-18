import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractCoverageEnd,
  formationContractStatus,
  formationTeachingDay,
} from "../src/formation.js";
import { periodConfirmation } from "../src/period-confirmation.js";

const base = { continuity: "UNDECIDED" as const, declined: false, enrolled: false, ready: false };
void it("requires explicit confirmation through the last day of the third calendar month", () => {
  const status = (end: string | null) =>
    formationContractStatus(end, { from: "2027-01-01", through: "2027-06-30" });
  assert.equal(status(null), "MISSING");
  assert.equal(status("2027-03-31"), "EARLY_END");
  assert.equal(status("2027-04-01"), "COVERED");
  assert.equal(
    formationContractStatus("2028-02-28", { from: "2027-11-30", through: "2028-05-30" }),
    "EARLY_END",
  );
});
void it("merges contiguous renewals and stops at the first uncovered day", () => {
  const first = { startsOn: "2027-01-01", endsOn: "2027-02-28" };
  assert.equal(
    contractCoverageEnd([{ startsOn: "2027-03-01", endsOn: "2027-06-30" }, first], "2027-01-01"),
    "2027-06-30",
  );
  assert.equal(
    contractCoverageEnd([first, { startsOn: "2027-03-02", endsOn: "2027-06-30" }], "2027-01-01"),
    "2027-02-28",
  );
  assert.equal(contractCoverageEnd([{ startsOn: null, endsOn: "2028-01-01" }], "2027-01-01"), null);
  assert.equal(contractCoverageEnd([first], "2026-12-31"), null);
});
void it("marks only eligible placements as automatic and preserves the operator's intention", () => {
  assert.equal(periodConfirmation(base), "PENDING");
  assert.equal(periodConfirmation({ ...base, ready: true }), "PRECONFIRMED");
  assert.equal(periodConfirmation({ ...base, continuity: "STAY" }), "CONFIRMED");
  assert.equal(periodConfirmation({ ...base, enrolled: true }), "CONFIRMED");
  assert.equal(periodConfirmation({ ...base, ready: true, continuity: "CHANGE" }), "CHANGING");
  assert.equal(periodConfirmation({ ...base, ready: true, declined: true }), "LEAVING");
});

void it("accepts Saturday classes through noon and keeps out-of-hours slots out of the weekly timetable", () => {
  assert.equal(formationTeachingDay({ weekday: "SATURDAY", endTime: "12:00" }), "SATURDAY");
  assert.equal(formationTeachingDay({ weekday: "SATURDAY", endTime: "12:01" }), null);
  assert.equal(formationTeachingDay({ weekday: "SUNDAY", endTime: "09:00" }), null);
  assert.equal(formationTeachingDay({ weekday: "MONDAY", endTime: "20:30" }), "MONDAY");
});
