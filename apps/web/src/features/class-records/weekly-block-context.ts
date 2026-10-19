import { createContext, useContext } from "react";
import type { WeeklyCalendarSelection } from "./weekly-calendar";
import type { CalendarLesson } from "./calendar-model";

import type { WeeklyBlock } from "./weekly-blocks";

export type WeeklyBlockInteraction = {
  selection?: WeeklyCalendarSelection | undefined;
  expandedId: string | null;
  keepExpanded: boolean;
  expand: (id: string | null, pointer?: boolean) => void;
  onOpen: (lesson: CalendarLesson) => void;
  onShowOverflow: (event: WeeklyBlock) => void;
};

export const WeeklyBlockContext = createContext<WeeklyBlockInteraction | null>(null);
export function useWeeklyBlock(): WeeklyBlockInteraction {
  const context = useContext(WeeklyBlockContext);
  if (!context) throw new Error("WeeklyBlockContext is required");
  return context;
}
