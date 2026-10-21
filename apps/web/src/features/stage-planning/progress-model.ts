type PageRange = { pageFrom: number | null; pageTo: number | null };
export function planningPosition(
  items: readonly (PageRange & { plannedOn: string })[],
  {
    records,
    today,
  }: { records: readonly { date: string; time: string; content: PageRange }[]; today: string },
): {
  expected: number | null;
  actual: number | null;
  lastDate: string | null;
} {
  const end = (range: PageRange): number | null => range.pageTo ?? range.pageFrom;
  const expected = items
    .filter((item) => item.plannedOn <= today)
    .flatMap((item) => (end(item) === null ? [] : [end(item)!]));
  const last = records
    .filter((row) => row.date <= today && end(row.content) !== null)
    .toSorted(
      (left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time),
    )[0];
  return {
    expected: expected.length > 0 ? Math.max(...expected) : null,
    actual: last ? end(last.content) : null,
    lastDate: last?.date ?? null,
  };
}
