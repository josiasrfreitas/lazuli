export type PeriodConfirmation = "CONFIRMED" | "PRECONFIRMED" | "PENDING" | "CHANGING" | "LEAVING";

export function periodConfirmation(input: {
  continuity: "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
  declined: boolean;
  enrolled: boolean;
  ready: boolean;
}): PeriodConfirmation {
  if (input.declined || input.continuity === "LEAVING") return "LEAVING";
  if (input.continuity === "CHANGE") return "CHANGING";
  if (input.continuity === "STAY" || input.enrolled) return "CONFIRMED";
  return input.ready ? "PRECONFIRMED" : "PENDING";
}
