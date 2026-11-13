type Activity = {
  id: string;
  sequence: number;
  kind: string;
  title: string;
  lessons: { lesson: { sequence: number }; part?: string | null }[];
};
/** Describe position in the source curriculum without inventing unknown activity content. */
export function programActivityLabels(activities: readonly Activity[]): Map<string, string> {
  const ordered = activities.toSorted((a, b) => a.sequence - b.sequence);
  const result = new Map<string, string>();
  for (const [index, activity] of ordered.entries()) {
    if (activity.kind === "LESSON") {
      result.set(activity.id, activity.title);
      continue;
    }
    if (activity.lessons.length) {
      const numbers = [...new Set(activity.lessons.map((l) => l.lesson.sequence))].toSorted(
        (a, b) => a - b,
      );
      const context =
        numbers.length === 1 ? `lição ${numbers[0]}` : `lições ${numbers.join(" e ")}`;
      result.set(activity.id, `${activity.title} · ${context}`);
      continue;
    }
    const previous = ordered.slice(0, index).findLast((a) => a.lessons.length);
    const next = ordered.slice(index + 1).find((a) => a.lessons.length);
    const from = previous ? Math.max(...previous.lessons.map((l) => l.lesson.sequence)) : null;
    const to = next ? Math.min(...next.lessons.map((l) => l.lesson.sequence)) : null;
    const transition =
      from !== null && to !== null
        ? from === to
          ? `durante a lição ${from}`
          : `entre as lições ${from} e ${to}`
        : from !== null
          ? `após a lição ${from}`
          : to !== null
            ? `antes da lição ${to}`
            : null;
    result.set(activity.id, transition ? `${activity.title} · ${transition}` : activity.title);
  }
  return result;
}
