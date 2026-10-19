import { timeMinutes, type CalendarLesson } from "./calendar-model";

export const VISIBLE_LANES = 4;
export type TimelineGroup = {
  id: string;
  start: number;
  end: number;
  lanes: number;
  placed: { lesson: CalendarLesson; lane: number }[];
};

/** Reuse a lane only after its previous lesson ends; touching lessons do not overlap. */
export function timelineGroups(lessons: CalendarLesson[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  let ends: number[] = [];
  const sorted = lessons.toSorted(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startTime.localeCompare(right.startTime) ||
      left.id.localeCompare(right.id),
  );
  for (const lesson of sorted) {
    const start = timeMinutes(lesson.startTime);
    const end = timeMinutes(lesson.endTime);
    let group = groups.at(-1);
    if (!group || start >= group.end || group.placed[0]?.lesson.date !== lesson.date) {
      group = { id: lesson.id, start, end, lanes: 0, placed: [] };
      groups.push(group);
      ends = [];
    }
    const free = ends.findIndex((value) => value <= start);
    const lane = free === -1 ? ends.length : free;
    ends[lane] = end;
    group.placed.push({ lesson, lane });
    group.end = Math.max(group.end, end);
    group.lanes = ends.length;
  }
  return groups;
}

/** Count hidden lessons at every boundary, avoiding a misleading all-day overflow block. */
export function timelineOverflow(
  group: TimelineGroup,
): { start: number; end: number; count: number }[] {
  const hidden = group.placed.filter((item) => item.lane >= VISIBLE_LANES - 1);
  const boundaries = [
    ...new Set(
      hidden.flatMap(({ lesson }) => [timeMinutes(lesson.startTime), timeMinutes(lesson.endTime)]),
    ),
  ].toSorted((left, right) => left - right);
  return boundaries.slice(0, -1).flatMap((start, index) => {
    const end = boundaries[index + 1]!;
    const count = hidden.filter(
      ({ lesson }) => timeMinutes(lesson.startTime) < end && timeMinutes(lesson.endTime) > start,
    ).length;
    return count > 0 ? [{ start, end, count }] : [];
  });
}
