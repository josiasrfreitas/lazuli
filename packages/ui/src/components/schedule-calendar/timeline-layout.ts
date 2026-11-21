import { timeMinutes } from "./model";
import type { CalendarEvent } from "./types";

export type TimelineGroup = {
  id: string;
  start: number;
  end: number;
  lanes: number;
  placed: { lesson: CalendarEvent; lane: number }[];
};

/** Reuse a lane only after its previous lesson ends; touching lessons do not overlap. */
export function timelineGroups(lessons: CalendarEvent[]): TimelineGroup[] {
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
    ends.splice(lane, 1, end);
    group.placed.push({ lesson, lane });
    group.end = Math.max(group.end, end);
    group.lanes = ends.length;
  }
  return groups;
}
