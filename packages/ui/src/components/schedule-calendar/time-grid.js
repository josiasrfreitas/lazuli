import TimeGridImport from "react-big-calendar/lib/TimeGrid.js";

// Node exposes this CommonJS default inside a module object; webpack unwraps it.
const TimeGrid =
  /** @type {import("./time-grid.js").CalendarTimeGrid | {default: import("./time-grid.js").CalendarTimeGrid}} */ (
    TimeGridImport
  );
export default "default" in TimeGrid ? TimeGrid.default : TimeGrid;
