type PlannedStep = { id: string; plannedOn: string };

/** A reference window around a planned encounter, never evidence of completed work. */
export function planningBand<T extends PlannedStep>(
  steps: readonly T[],
  date: string,
  actualItemId?: string | null,
) {
  const items = steps.toSorted((a, b) => a.plannedOn.localeCompare(b.plannedOn));
  const dates = [...new Set(items.map((item) => item.plannedOn))];
  const dueDate = dates.findLastIndex((day) => day <= date);
  const anchor = Math.max(0, dueDate);
  const lowerDate = dates[Math.max(0, anchor - 1)];
  const upperDate = dates[Math.min(dates.length - 1, anchor + 1)];
  const lower = items.findIndex((item) => item.plannedOn === lowerDate);
  const upper = items.findLastIndex((item) => item.plannedOn === upperDate);
  const expected =
    dueDate < 0 ? -1 : items.findLastIndex((item) => item.plannedOn === dates[anchor]);
  const actual = items.findIndex((item) => item.id === actualItemId);
  const position =
    actual < 0 || lower < 0
      ? "UNKNOWN"
      : actual < lower
        ? "BEHIND"
        : actual > upper
          ? "AHEAD"
          : "WITHIN";
  return { items, lower, upper, expected, actual, position, lowerDate, upperDate } as const;
}
