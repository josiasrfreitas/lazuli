import { addCalendarMonths } from "./monthly-contract.js";

const PRECONFIRMATION_MONTHS = 3;

/** Coverage is inclusive: a January 1 start needs a contract through March 31. */
export function preconfirmationThrough(periodStart: string): string {
  const boundary = new Date(`${addCalendarMonths(periodStart, PRECONFIRMATION_MONTHS)}T12:00:00Z`);
  boundary.setUTCDate(boundary.getUTCDate() - 1);
  return boundary.toISOString().slice(0, 10);
}

export type PeriodConfirmation = "CONFIRMED" | "PRECONFIRMED" | "PENDING" | "CHANGING" | "LEAVING";

export function periodConfirmation(input: {
  continuity: "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
  declined: boolean;
  enrolled: boolean;
  periodStart: string;
  contracts: Array<{ startsOn: string | null; endsOn: string | null }>;
}): PeriodConfirmation {
  if (input.declined || input.continuity === "LEAVING") return "LEAVING";
  if (input.continuity === "CHANGE") return "CHANGING";
  if (input.continuity === "STAY" || input.enrolled) return "CONFIRMED";
  const through = preconfirmationThrough(input.periodStart);
  return input.contracts.some(
    (contract) =>
      contract.startsOn &&
      contract.endsOn &&
      contract.startsOn <= input.periodStart &&
      contract.endsOn >= through,
  )
    ? "PRECONFIRMED"
    : "PENDING";
}
