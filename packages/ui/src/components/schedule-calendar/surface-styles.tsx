import type { ReactElement } from "react";
import type { SurfaceProps } from "./surface-model";

const TIME_AXIS_WIDTH = 52;
export const EVENT_MIN_WIDTH = 164;
const COMPACT_DAY_WIDTH = 84;
const COMFORTABLE_DAY_WIDTH = 203;
const WEEK_DAYS = 7;
export type SurfaceDimensions = {
  scope: string;
  dayCount: number;
  dailyColumns: number;
  expandedDayWidth: number;
  expandedDayGrow: number;
};

export function CalendarSurfaceStyles({
  props,
  dimensions,
}: {
  props: SurfaceProps;
  dimensions: SurfaceDimensions;
}): ReactElement {
  const { scope, dayCount, dailyColumns } = dimensions;
  const { view, density = "comfortable" } = props;
  const dailyWidth = TIME_AXIS_WIDTH + dailyColumns * EVENT_MIN_WIDTH;
  const dayWidth = density === "compact" ? COMPACT_DAY_WIDTH : COMFORTABLE_DAY_WIDTH;
  return (
    <>
      {view === "day" && props.widthBehavior !== "fit" && (
        <style>{`[data-calendar-layout="${scope}"] > .lz-week-calendar { min-width: ${dailyWidth}px; }`}</style>
      )}
      {view === "week" && dayCount !== WEEK_DAYS && props.widthBehavior !== "fit" && (
        <style>{`.lz-calendar-viewport[data-calendar-layout="${scope}"][data-view="week"][data-density="${density}"] > .lz-week-calendar { min-width: ${TIME_AXIS_WIDTH + dayCount * dayWidth}px; }`}</style>
      )}
      {view === "week" && <ExpandedDayStyle dimensions={dimensions} />}
    </>
  );
}

function ExpandedDayStyle({ dimensions }: { dimensions: SurfaceDimensions }): ReactElement {
  return (
    <style>{`
    .lz-calendar-viewport[data-calendar-layout="${dimensions.scope}"] .rbc-header,
    .lz-calendar-viewport[data-calendar-layout="${dimensions.scope}"] .rbc-day-slot {
      max-width: none;
    }
    .lz-calendar-viewport[data-calendar-layout="${dimensions.scope}"] .rbc-header.lz-calendar-expanded-day,
    .lz-calendar-viewport[data-calendar-layout="${dimensions.scope}"] .rbc-day-slot.lz-calendar-expanded-day {
      flex-grow: ${dimensions.expandedDayGrow};
    }
  `}</style>
  );
}
