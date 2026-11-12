/** Small, pure aggregation rules shared by teacher metric summaries and their details. */
export function mean(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : null;
}
export function studentMean(rows: readonly { studentId: string; score: number }[]): number | null {
  const students = new Map<string, number[]>();
  for (const row of rows) {
    const values = students.get(row.studentId) ?? [];
    values.push(row.score);
    students.set(row.studentId, values);
  }
  return mean([...students.values()].map(mean));
}
export function absenceSummary(
  rows: readonly {
    heldMinutes: number;
    absentMinutes: number;
    compensatedMinutes: number;
    missingRows: number;
    due: number;
    confirmed: number;
  }[],
) {
  const total = rows.reduce(
    (sum, row) => ({
      heldMinutes: sum.heldMinutes + row.heldMinutes,
      absentMinutes: sum.absentMinutes + row.absentMinutes,
      compensatedMinutes:
        sum.compensatedMinutes + Math.min(row.absentMinutes, row.compensatedMinutes),
      missingRows: sum.missingRows + row.missingRows,
      due: sum.due + row.due,
      confirmed: sum.confirmed + row.confirmed,
    }),
    {
      heldMinutes: 0,
      absentMinutes: 0,
      compensatedMinutes: 0,
      missingRows: 0,
      due: 0,
      confirmed: 0,
    },
  );
  return {
    ...total,
    percent: total.heldMinutes ? (100 * total.absentMinutes) / total.heldMinutes : null,
    remainingPercent: total.heldMinutes
      ? (100 * (total.absentMinutes - total.compensatedMinutes)) / total.heldMinutes
      : null,
  };
}
export function inWindow(date: Date, window: { start: Date; end: Date | null }): boolean {
  return date >= window.start && (!window.end || date < window.end);
}
