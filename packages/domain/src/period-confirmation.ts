export type PeriodConfirmation =
  | "CONFIRMED"
  | "PRECONFIRMED"
  | "BLOCKED"
  | "PENDING"
  | "CHANGING"
  | "LEAVING";

export function followsOwnClass(
  sourceClassId: string | null,
  plan: {
    classId: string | null;
    sourceClassId: string | null;
    previousClassId: string | null;
  } | null,
): boolean {
  return Boolean(
    sourceClassId &&
    plan &&
    (sourceClassId === plan.classId ||
      sourceClassId === (plan.previousClassId ?? plan.sourceClassId)),
  );
}

export function periodConfirmation(input: {
  continuity: "UNDECIDED" | "STAY" | "CHANGE" | "LEAVING";
  declined: boolean;
  enrolled: boolean;
  ready: boolean;
  continuing: boolean;
}): PeriodConfirmation {
  if (input.declined) return "LEAVING";
  if (input.enrolled) return "CONFIRMED";
  if (input.continuity === "LEAVING") return input.continuing ? "BLOCKED" : "LEAVING";
  if (input.continuity === "CHANGE") return "CHANGING";
  if (!input.continuing) return "PENDING";
  return input.ready ? "PRECONFIRMED" : "BLOCKED";
}
