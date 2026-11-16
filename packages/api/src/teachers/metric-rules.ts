const PERCENT = 100;
export type AttendanceTotals = {
  heldMinutes: number;
  absentMinutes: number;
  compensatedMinutes: number;
  missingRows: number;
  due: number;
  confirmed: number;
};
export type AbsenceSummary = AttendanceTotals & {
  percent: number | null;
  remainingPercent: number | null;
};

/** Small, pure aggregation rules shared by teacher metric summaries and their details. */
export function mean(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0
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
  return mean([...students.values()].map((values) => mean(values)));
}
export function absenceSummary(rows: readonly AttendanceTotals[]): AbsenceSummary {
  const total: AttendanceTotals = {
    heldMinutes: 0,
    absentMinutes: 0,
    compensatedMinutes: 0,
    missingRows: 0,
    due: 0,
    confirmed: 0,
  };
  for (const row of rows) {
    total.heldMinutes += row.heldMinutes;
    total.absentMinutes += row.absentMinutes;
    total.compensatedMinutes += Math.min(row.absentMinutes, row.compensatedMinutes);
    total.missingRows += row.missingRows;
    total.due += row.due;
    total.confirmed += row.confirmed;
  }
  return {
    ...total,
    percent: total.heldMinutes ? (PERCENT * total.absentMinutes) / total.heldMinutes : null,
    remainingPercent: total.heldMinutes
      ? (PERCENT * (total.absentMinutes - total.compensatedMinutes)) / total.heldMinutes
      : null,
  };
}
export function inWindow(date: Date, window: { start: Date; end: Date | null }): boolean {
  return date >= window.start && (!window.end || date < window.end);
}
