import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractCoverageEnd,
  formationContractStatus,
  formationTeachingDay,
  formationPlacementBlockers,
} from "../src/formation.js";
import { followsOwnClass, periodConfirmation } from "../src/period-confirmation.js";

const base = {
  continuity: "UNDECIDED" as const,
  declined: false,
  enrolled: false,
  ready: false,
  continuing: false,
};
void it("requires coverage beyond the midpoint of the actual teaching period", () => {
  const status = (end: string | null): ReturnType<typeof formationContractStatus> =>
    formationContractStatus(end, { from: "2027-01-01", through: "2027-06-30" });
  assert.equal(
    formationContractStatus("2027-02-15", { from: "2027-02-01", through: "2027-03-01" }),
    "EARLY_END",
  );
  assert.equal(
    formationContractStatus("2027-02-16", { from: "2027-02-01", through: "2027-03-01" }),
    "COVERED",
  );
  assert.equal(status(null), "MISSING");
  assert.equal(status("2027-03-31"), "EARLY_END");
  assert.equal(status("2027-04-01"), "EARLY_END");
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
  const own = { classId: "new", sourceClassId: "old", previousClassId: null };
  assert.equal(followsOwnClass("old", own), true);
  assert.equal(followsOwnClass("other", own), false);
  assert.equal(
    followsOwnClass("old", { ...own, sourceClassId: null, previousClassId: "old" }),
    true,
  );
  assert.equal(followsOwnClass(null, own), false);
  assert.equal(periodConfirmation({ ...base, ready: true, continuing: true }), "PRECONFIRMED");
  assert.equal(periodConfirmation({ ...base, continuity: "LEAVING", continuing: true }), "BLOCKED");
  assert.equal(periodConfirmation(base), "PENDING");
  assert.equal(periodConfirmation({ ...base, ready: true }), "PENDING");
  assert.equal(periodConfirmation({ ...base, continuity: "STAY" }), "PENDING");
  assert.equal(periodConfirmation({ ...base, continuing: true }), "BLOCKED");
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

void it("keeps academic and staff reasons independent from an active exit risk or legacy stay", () => {
  const signals = {
    continuing: true,
    continuity: "STAY",
    contractStatus: "COVERED" as const,
    materialMissing: false,
    grades: "NEEDS_SUPPORT",
    attendanceFlagged: false,
    staffImpediment: true,
    exitRiskActive: true,
  };
  assert.deepEqual(formationPlacementBlockers(signals), [
    "Impedimento sinalizado pela equipe",
    "Risco de saída",
    "Notas insuficientes",
  ]);
  assert.deepEqual(
    formationPlacementBlockers({ ...signals, grades: "SUFFICIENT", staffImpediment: false }),
    ["Risco de saída"],
  );
  assert.deepEqual(
    formationPlacementBlockers({
      ...signals,
      grades: "INCOMPLETE",
      staffImpediment: false,
      exitRiskActive: false,
    }),
    [],
  );
});
