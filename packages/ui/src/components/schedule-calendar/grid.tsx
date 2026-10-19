"use client";

import { useMemo, type ReactElement } from "react";
import { Calendar, dateFnsLocalizer, type CalendarProps } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { createRangeView } from "./range-view";
import type { CalendarDateRange } from "./types";

const localizer = dateFnsLocalizer({
  format,
  parse,
  getDay,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  locales: { "pt-BR": ptBR },
});

export type CalendarGridProps<Event extends object> = Omit<
  CalendarProps<Event>,
  "localizer" | "views" | "toolbar" | "culture"
> & {
  view: "day" | "week";
  range: CalendarDateRange;
  density?: "comfortable" | "compact";
  loading?: boolean;
  label?: string;
};

/** Controlled time grid for a consecutive date range. Dates represent wall-clock values in the consumer's timezone.
 * The consumer owns navigation, eligibility, persistence and conflict validation.
 * Provide a keyboard-accessible form alongside pointer-based slot selection.
 */
export function CalendarGrid<Event extends object>({
  view,
  range,
  density = "comfortable",
  loading = false,
  label = "Agenda semanal",
  className,
  ...props
}: CalendarGridProps<Event>): ReactElement {
  const rangeView = useMemo(
    () => createRangeView({ from: range.from, through: range.through }),
    [range.from, range.through],
  );
  return (
    <div className="lz-week-calendar" data-density={density} aria-label={label} aria-busy={loading}>
      <Calendar<Event>
        localizer={localizer}
        culture="pt-BR"
        view={view}
        views={{ day: true, week: rangeView }}
        toolbar={false}
        step={30}
        timeslots={2}
        formats={{ timeGutterFormat: "HH:mm", dayFormat: "EEE dd", eventTimeRangeFormat: () => "" }}
        messages={{ allDay: "Dia inteiro", noEventsInRange: "Nenhum compromisso neste período" }}
        {...props}
        events={loading ? [] : props.events}
        selectable={loading ? false : props.selectable}
        className={cn("lz-week-calendar-grid", className)}
      />
    </div>
  );
}
