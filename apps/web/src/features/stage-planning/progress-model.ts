type PageRange = { pageFrom: number | null; pageTo: number | null };
export function planningPosition(
  items: readonly (PageRange & { plannedOn: string })[],
  options: {
    records: readonly {
      date: string;
      time: string;
      content: PageRange;
    }[];
    today: string;
  },
): {
  expected: number | null;
  actual: number | null;
  lastDate: string | null;
  scale: number;
  hasPlannedPages: boolean;
} {
  const { records, today } = options;

  const end = (range: PageRange): number | null => range.pageTo ?? range.pageFrom;
  const expected = items
    .filter((item) => item.plannedOn <= today)
    .flatMap((item) => (end(item) === null ? [] : [end(item)!]));
  const last = records
    .filter((row) => row.date <= today && end(row.content) !== null)
    .toSorted(
      (left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time),
    )[0];
  const plannedPages = items.flatMap((item) => (end(item) === null ? [] : [end(item)!]));
  return {
    expected: expected.length > 0 ? Math.max(...expected) : null,
    actual: last ? end(last.content) : null,
    lastDate: last?.date ?? null,
    scale: Math.max(1, ...plannedPages, last ? end(last.content)! : 0),
    hasPlannedPages: plannedPages.length > 0,
  };
}
