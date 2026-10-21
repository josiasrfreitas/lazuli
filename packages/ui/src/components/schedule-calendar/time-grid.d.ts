import type { ComponentType } from "react";
import type { ViewProps } from "react-big-calendar";

export type CalendarTimeGrid = ComponentType<ViewProps & { range: Date[]; eventOffset?: number }>;
declare const TimeGrid: CalendarTimeGrid;
export default TimeGrid;
