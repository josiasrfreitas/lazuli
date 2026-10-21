import type { ReactElement } from "react";
import type { NavigateAction, ViewProps, ViewStatic } from "react-big-calendar";
import TimeGrid from "./time-grid.js";
import { calendarRangeDates } from "./date-window";
import { calendarDateKey, calendarWallDate, shiftDate } from "./model";
import type { CalendarDateRange } from "./types";

type RangeViewComponent = ((props: ViewProps) => ReactElement) & ViewStatic;

export function createRangeView(range: CalendarDateRange): RangeViewComponent {
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
    const direction = navigateDirection(action);
    return calendarWallDate(shiftDate(calendarDateKey(date), direction * dates.length));
  };
  RangeView.title = (): string => `${range.from}–${range.through}`;
  return RangeView;
}

function navigateDirection(action: NavigateAction): number {
  if (action === "PREV") return -1;
  return action === "NEXT" ? 1 : 0;
}
