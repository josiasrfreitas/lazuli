type Activity = {
  id: string;
  sequence: number;
  kind: string;
  title: string;
  lessons: { lesson: { sequence: number }; part?: string | null }[];
};
/** Describe position in the source curriculum without inventing unknown activity content. */
export function programActivityLabels(activities: readonly Activity[]): Map<string, string> {
  const ordered = activities.toSorted((left, right) => left.sequence - right.sequence);
  const result = new Map<string, string>();
  for (const [index, activity] of ordered.entries()) {
    result.set(activity.id, activityLabel({ activity, index, ordered }));
  }
  return result;
}
function activityLabel({
  activity,
  index,
  ordered,
}: {
  activity: Activity;
  index: number;
  ordered: readonly Activity[];
}): string {
  if (activity.kind === "LESSON") return activity.title;
  if (activity.lessons.length > 0) {
    const numbers = [...new Set(activity.lessons.map((link) => link.lesson.sequence))].toSorted(
      (left, right) => left - right,
    );
    const context = numbers.length === 1 ? `lição ${numbers[0]}` : `lições ${numbers.join(" e ")}`;
    return `${activity.title} · ${context}`;
  }
  const previous = ordered.slice(0, index).findLast((item) => item.lessons.length > 0);
  const next = ordered.slice(index + 1).find((item) => item.lessons.length > 0);
  const from = previous ? Math.max(...previous.lessons.map((link) => link.lesson.sequence)) : null;
  const to = next ? Math.min(...next.lessons.map((link) => link.lesson.sequence)) : null;
  const transition = transitionLabel({ from, to });
  return transition ? `${activity.title} · ${transition}` : activity.title;
}
function transitionLabel({ from, to }: { from: number | null; to: number | null }): string | null {
  if (from !== null && to !== null)
    return from === to ? `durante a lição ${from}` : `entre as lições ${from} e ${to}`;
  if (from !== null) return `após a lição ${from}`;
  return to === null ? null : `antes da lição ${to}`;
}
