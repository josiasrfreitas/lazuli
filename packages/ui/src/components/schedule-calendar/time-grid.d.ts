import type { ComponentType } from "react";
import type { ViewProps } from "react-big-calendar";

declare const TimeGrid: ComponentType<ViewProps & { range: Date[]; eventOffset?: number }>;
export default TimeGrid;
