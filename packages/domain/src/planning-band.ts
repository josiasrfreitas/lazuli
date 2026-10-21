type PlannedStep = { id: string; plannedOn: string };
type PlanningPosition = "UNKNOWN" | "BEHIND" | "AHEAD" | "WITHIN";
type PlanningBand<T> = {
  items: T[];
  lower: number;
  upper: number;
  expected: number;
  actual: number;
  position: PlanningPosition;
  lowerDate: string | undefined;
  upperDate: string | undefined;
};

/** A reference window around a planned encounter, never evidence of completed work. */
export function planningBand<T extends PlannedStep>(
  steps: readonly T[],
  input: { date: string; actualItemId?: string | null },
): PlanningBand<T> {
  const { date, actualItemId } = input;
  const items = steps.toSorted((left, right) => left.plannedOn.localeCompare(right.plannedOn));
  const dates = [...new Set(items.map((item) => item.plannedOn))];
  const dueDate = dates.findLastIndex((day) => day <= date);
  const anchor = Math.max(0, dueDate);
  const lowerDate = dates[Math.max(0, anchor - 1)];
  const upperDate = dates[Math.min(dates.length - 1, anchor + 1)];
  const lower = items.findIndex((item) => item.plannedOn === lowerDate);
  const upper = items.findLastIndex((item) => item.plannedOn === upperDate);
  const expected =
    dueDate === -1 ? -1 : items.findLastIndex((item) => item.plannedOn === dates.at(anchor));
  const actual = items.findIndex((item) => item.id === actualItemId);
  const position = positionOf(actual, { lower, upper });
  return { items, lower, upper, expected, actual, position, lowerDate, upperDate } as const;
}

function positionOf(actual: number, bounds: { lower: number; upper: number }): PlanningPosition {
  if (actual === -1 || bounds.lower === -1) return "UNKNOWN";
  if (actual < bounds.lower) return "BEHIND";
  return actual > bounds.upper ? "AHEAD" : "WITHIN";
}
