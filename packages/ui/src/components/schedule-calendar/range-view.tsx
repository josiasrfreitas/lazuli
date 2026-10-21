import type { ReactElement } from "react";
import type { NavigateAction, ViewProps } from "react-big-calendar";
import TimeGrid from "./time-grid.js";
import { calendarRangeDates } from "./date-window";
import { calendarDateKey, calendarWallDate, shiftDate } from "./model";
import type { CalendarDateRange } from "./types";

type CalendarRangeView = ((props: ViewProps) => ReactElement) & {
  range: () => Date[];
  navigate: (date: Date, action: NavigateAction) => Date;
  title: () => string;
};
export function createRangeView(range: CalendarDateRange): CalendarRangeView {
  const dates = calendarRangeDates(range).map((date) => calendarWallDate(date));
  function RangeView(props: ViewProps): ReactElement {
    return (
      <TimeGrid
        {...props}
        range={dates}
        eventOffset={15}
        enableAutoScroll={props.enableAutoScroll ?? true}
      />
    );
  }
  RangeView.range = (): Date[] => dates;
  RangeView.navigate = (date: Date, action: NavigateAction): Date => {
    const direction = navigationDirection(action);
    return calendarWallDate(shiftDate(calendarDateKey(date), direction * dates.length));
  };
  RangeView.title = (): string => `${range.from}–${range.through}`;
  return RangeView;
}

function navigationDirection(action: NavigateAction): number {
  if (action === "PREV") return -1;
  return action === "NEXT" ? 1 : 0;
}
