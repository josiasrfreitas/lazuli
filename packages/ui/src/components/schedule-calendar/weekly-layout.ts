import type { DayLayoutFunction } from "react-big-calendar";
import type { WeeklyBlock } from "./weekly-blocks";

const PERCENT = 100;
// Keep neighboring lanes narrower than their resting width as the day expands.
// This keeps the hovered card under the pointer, including the first and last day.
const EXPANDED_SHARE = 5;

type SlotMetrics = { getRange: (start: Date, end: Date) => { top: number; height: number } };

/** Only horizontal space changes on hover; temporal geometry belongs to the calendar. */
export function weeklyLaneGeometry(
  event: WeeklyBlock,
  expanded?: WeeklyBlock,
): { left: number; width: number } {
  const selected = !event.revealed && expanded?.groupId === event.groupId ? expanded.lane : -1;
  const total = event.columns + (selected < 0 ? 0 : EXPANDED_SHARE - 1);
  const before = event.lane + (selected >= 0 && selected < event.lane ? EXPANDED_SHARE - 1 : 0);
  return {
    left: (before / total) * PERCENT,
    width: ((selected === event.lane ? EXPANDED_SHARE : 1) / total) * PERCENT,
  };
}

export function weeklyDayLayout(expandedId: string | null): DayLayoutFunction<WeeklyBlock> {
  return ({ events, slotMetrics }: { events: WeeklyBlock[]; slotMetrics: SlotMetrics }) => {
    const expanded = events.find((event) => event.id === expandedId);
    return events.map((event) => {
      const { top, height } = slotMetrics.getRange(event.start, event.end);
      const { left, width } = weeklyLaneGeometry(event, expanded);
      return {
        event,
        style: {
          top,
          height: `calc(${height}% - 2px)`,
          width: `calc(${width}% - 2px)`,
          xOffset: `${left}%`,
        },
      };
    });
  };
}
