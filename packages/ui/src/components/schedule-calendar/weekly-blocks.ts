import { timeMinutes, calendarWallDate, monday, shiftDate } from "./model";
import type { CalendarEvent, CalendarDateRange } from "./types";
import { timelineGroups, type TimelineGroup } from "./timeline-layout";

const LAST_WEEKDAY = 6;
const VISIBLE_LESSONS = 4;
const MINUTES_PER_HOUR = 60;

export type WeeklyBlock = {
  id: string;
  groupId: string;
  kind: "lesson" | "overflow";
  date: string;
  title: string;
  start: Date;
  end: Date;
  startTime: string;
  endTime: string;
  lane: number;
  columns: number;
  lessons: CalendarEvent[];
  revealed?: boolean;
};

function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

function placeActive(active: CalendarEvent[], lanes: Map<string, number>): void {
  for (const id of lanes.keys()) if (!active.some((lesson) => lesson.id === id)) lanes.delete(id);
  for (const lesson of active) {
    if (lanes.has(lesson.id) || lanes.size === VISIBLE_LESSONS) continue;
    const lane = Array.from({ length: VISIBLE_LESSONS }, (_value, index) => index).find(
      (index) => ![...lanes.values()].includes(index),
    )!;
    lanes.set(lesson.id, lane);
  }
}

function entry(input: {
  group: TimelineGroup;
  lessons: CalendarEvent[];
  lane: number;
  start: number;
  end: number;
}): WeeklyBlock {
  const { group, lessons, lane, start, end } = input;
  const first = lessons[0]!;
  const kind = lane === VISIBLE_LESSONS ? "overflow" : "lesson";
  const startTime = clockTime(start);
  const endTime = clockTime(end);
  return {
    id: `${kind}-${first.id}-${start}`,
    groupId: group.id,
    kind,
    date: first.date,
    title:
      kind === "overflow"
        ? `Mais ${lessons.length}`
        : `${first.title} · ${first.startTime}–${first.endTime}`,
    start: calendarWallDate(first.date, startTime),
    end: calendarWallDate(first.date, endTime),
    startTime,
    endTime,
    lane,
    columns: Math.min(group.lanes, VISIBLE_LESSONS + 1),
    lessons,
  };
}

/** Merge unchanged slices so a lesson remains one continuous, correctly timed rectangle. */
function appendEntry(result: WeeklyBlock[], next: WeeklyBlock): void {
  const previous = result.findLast((item) => item.lane === next.lane);
  if (
    previous?.endTime === next.startTime &&
    previous.lessons.map((item) => item.id).join(",") ===
      next.lessons.map((item) => item.id).join(",")
  ) {
    previous.end = next.end;
    previous.endTime = next.endTime;
  } else result.push(next);
}

function groupEntries(group: TimelineGroup): WeeklyBlock[] {
  const lessons = group.placed.map((item) => item.lesson);
  const boundaries = [
    ...new Set(
      lessons.flatMap((lesson) => [timeMinutes(lesson.startTime), timeMinutes(lesson.endTime)]),
    ),
  ].toSorted((left, right) => left - right);
  const lanes = new Map<string, number>();
  const result: WeeklyBlock[] = [];
  for (const [index, start] of boundaries.slice(0, -1).entries()) {
    const end = boundaries[index + 1]!;
    const active = lessons.filter(
      (lesson) => timeMinutes(lesson.startTime) <= start && timeMinutes(lesson.endTime) > start,
    );
    placeActive(active, lanes);
    const hidden = active.filter((lesson) => !lanes.has(lesson.id));
    for (const lesson of active.filter((item) => lanes.has(item.id)))
      appendEntry(
        result,
        entry({ group, lessons: [lesson], lane: lanes.get(lesson.id)!, start, end }),
      );
    if (hidden.length > 0)
      appendEntry(result, entry({ group, lessons: hidden, lane: VISIBLE_LESSONS, start, end }));
  }
  return result;
}

/** Overflow exists only while more than four lessons actually coincide. */
export function weeklyBlocks(
  lessons: CalendarEvent[],
  { date, range }: { date: string; range?: CalendarDateRange },
): WeeklyBlock[] {
  const visible = range ?? { from: monday(date), through: shiftDate(monday(date), LAST_WEEKDAY) };
  return timelineGroups(
    lessons.filter((event) => event.date >= visible.from && event.date <= visible.through),
  ).flatMap((group) => groupEntries(group));
}

/** Reveal every lesson in the overlap group at its full, original duration. */
export function revealWeeklyBlocks(events: WeeklyBlock[], groupId: string | null): WeeklyBlock[] {
  if (!groupId) return events;
  const lessons = [
    ...new Map(
      events
        .filter((event) => event.groupId === groupId)
        .flatMap((event) => event.lessons)
        .map((lesson) => [lesson.id, lesson]),
    ).values(),
  ];
  const revealed = timelineGroups(lessons).flatMap((group) =>
    group.placed.map(({ lesson, lane }) => {
      const block = entry({
        group,
        lessons: [lesson],
        lane: 0,
        start: timeMinutes(lesson.startTime),
        end: timeMinutes(lesson.endTime),
      });
      return { ...block, lane, columns: group.lanes, revealed: true };
    }),
  );
  return [...events.filter((event) => event.groupId !== groupId), ...revealed];
}

export function dailyBlocks(events: CalendarEvent[], date: string): WeeklyBlock[] {
  return timelineGroups(events.filter((event) => event.date === date)).flatMap((group) =>
    group.placed.map(({ lesson, lane }) => ({
      ...entry({
        group,
        lessons: [lesson],
        lane: 0,
        start: timeMinutes(lesson.startTime),
        end: timeMinutes(lesson.endTime),
      }),
      lane,
      columns: group.lanes,
    })),
  );
}

/** Resolve the active card after an overflow button has been replaced by its lessons. */
export function expandedWeeklyBlock(
  events: WeeklyBlock[],
  id: string | null,
): WeeklyBlock | undefined {
  return events.find((event) => event.id === id) ?? events.find((event) => event.revealed);
}
