declare module "react-big-calendar/lib/TimeGrid.js" {
  import type { ComponentType } from "react";
  import type { ViewProps } from "react-big-calendar";
  const TimeGrid: ComponentType<ViewProps & { range: Date[]; eventOffset?: number }>;
  export default TimeGrid;
}
