import assert from "node:assert/strict";
import { it } from "node:test";
import { periodConfirmation, preconfirmationThrough } from "../src/period-confirmation.js";

const base = {
  continuity: "UNDECIDED" as const,
  declined: false,
  enrolled: false,
  periodStart: "2027-01-01",
  contracts: [],
};
void it("preconfirms only when a contract covers the first three months inclusively", () => {
  assert.equal(preconfirmationThrough("2027-01-01"), "2027-03-31");
  assert.equal(
    periodConfirmation({ ...base, contracts: [{ startsOn: "2026-01-01", endsOn: "2027-03-31" }] }),
    "PRECONFIRMED",
  );
  assert.equal(
    periodConfirmation({ ...base, contracts: [{ startsOn: "2026-01-01", endsOn: "2027-03-30" }] }),
    "PENDING",
  );
  assert.equal(
    periodConfirmation({ ...base, contracts: [{ startsOn: "2027-01-02", endsOn: "2028-01-01" }] }),
    "PENDING",
  );
});
void it("handles calendar months rather than ninety days", () => {
  assert.equal(preconfirmationThrough("2027-11-30"), "2028-02-28");
  assert.equal(preconfirmationThrough("2027-08-15"), "2027-11-14");
});
void it("keeps manual intent independent of contract renewal", () => {
  assert.equal(periodConfirmation({ ...base, continuity: "STAY" }), "CONFIRMED");
  assert.equal(periodConfirmation(base), "PENDING");
  assert.equal(periodConfirmation({ ...base, enrolled: true }), "CONFIRMED");
});
void it("preserves an explicit change or departure despite contract coverage or enrollment", () => {
  const covered = {
    ...base,
    enrolled: true,
    contracts: [{ startsOn: "2026-01-01", endsOn: "2028-01-01" }],
  };
  assert.equal(periodConfirmation({ ...covered, continuity: "CHANGE" }), "CHANGING");
  assert.equal(periodConfirmation({ ...covered, continuity: "LEAVING" }), "LEAVING");
  assert.equal(periodConfirmation({ ...covered, declined: true }), "LEAVING");
});
void it("does not preconfirm undated contracts or combine a gap between contracts", () => {
  assert.equal(
    periodConfirmation({ ...base, contracts: [{ startsOn: null, endsOn: "2028-01-01" }] }),
    "PENDING",
  );
  assert.equal(
    periodConfirmation({ ...base, contracts: [{ startsOn: "2026-01-01", endsOn: null }] }),
    "PENDING",
  );
  assert.equal(
    periodConfirmation({
      ...base,
      contracts: [
        { startsOn: "2026-01-01", endsOn: "2027-02-01" },
        { startsOn: "2027-02-03", endsOn: "2028-01-01" },
      ],
    }),
    "PENDING",
  );
});
