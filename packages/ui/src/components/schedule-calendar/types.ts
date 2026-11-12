import type { ReactNode } from "react";

export type CalendarView = "day" | "week";
export type CalendarDateRange = { from: string; through: string };
export type CalendarDateWindow = {
  date: string;
  view: CalendarView;
  /** Consecutive days starting at date. Omit to retain Monday–Sunday in week view. */
  dayCount?: number;
  /** Inclusive civil-date bounds, independent of time-slot selection. */
  minDate?: string | undefined;
  maxDate?: string | undefined;
};
/** Civil date and wall-clock time in the calendar's timeZone; never UTC timestamps. */
export type CalendarInterval = { date: string; startTime: string; endTime: string };
export type CalendarEvent = CalendarInterval & {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tone?: "neutral" | "accent" | "info" | "success" | "warning" | "danger";
  disabled?: boolean;
  disabledReason?: string;
};
export type CalendarBlockedInterval = CalendarInterval & { id: string; label: string };
export type CalendarEventRenderContext = {
  view: CalendarView;
  expanded: boolean;
  /** Final weekly day width before transitions, for measuring custom expanded content. */
  expandedDayWidth?: number | undefined;
  /** Final percentage of the day occupied by this individual expanded event. */
  expandedWidthShare?: number | undefined;
  selected: boolean;
  disabled: boolean;
  activate: () => void;
  toggleExpanded: () => void;
};
export type CalendarRangeSelection = {
  /** Duration used for a single slot click; dragging retains the chosen interval. */
  clickDurationMinutes?: number;
  value?: CalendarInterval | null | undefined;
  onSelect: (range: CalendarInterval) => void;
  /** All commitments that block a new range, including events hidden by filters. */
  blocked?: readonly CalendarBlockedInterval[];
  minimum?: { date: string; time: string };
  /** Pure, synchronous business validation. Revalidate authoritatively when saving. */
  getError?: (range: CalendarInterval) => string | null | undefined;
  /** Supply existing date/time controls, or use the built-in keyboard-accessible editor. */
  controls?: ReactNode;
};
export type ScheduleCalendarProps<Event extends CalendarEvent = CalendarEvent> =
  CalendarDateWindow & {
    events: readonly Event[];
    onDateChange: (date: string) => void;
    onViewChange: (view: CalendarView) => void;
    /** Presentation and clock only: input civil dates/times are not converted. */
    timeZone?: string;
    /** Fixed window stays usable when there are no events. End can be 24:00. */
    hours?: { start: string; end: string };
    density?: "comfortable" | "compact";
    /** Allow vertical scrolling to continue into the containing page at the grid limits. */
    scrollChaining?: boolean;
    /** Read-only agendas can omit the empty time grid while retaining navigation. */
    emptyDisplay?: "grid" | "message";
    /** Fit every day and overlap lane within the container, or retain readable scrolling lanes. */
    widthBehavior?: "scroll" | "fit";
    status?: "ready" | "loading" | "error";
    errorMessage?: string;
    onRetry?: () => void;
    selectedEventId?: string | null | undefined;
    expandedEventId?: string | null | undefined;
    /** Preferred expanded event width in pixels in week view, bounded by available space. */
    expandedEventWidth?: number | undefined;
    /** Expand clipped cards on hover/focus. Explicit overflow controls remain available. */
    expandEvents?: boolean;
    /** Optional label for the toolbar date picker. */
    dateLabel?: string | undefined;
    keepExpanded?: boolean;
    onEventActivate?: (event: Event) => void;
    /** Replaces the entire event card; own its buttons and accessible labels. */
    renderEvent?: ((event: Event, context: CalendarEventRenderContext) => ReactNode) | undefined;
    rangeSelection?: CalendarRangeSelection | undefined;
    /** Domain filters/actions stay outside the calendar's data model. */
    filters?: ReactNode;
    actions?: ReactNode;
    /** Replaces the day/week selector with a domain-specific view control. */
    viewControl?: ReactNode;
    toolbar?: boolean;
    className?: string;
    label?: string;
    emptyMessage?: string;
  };
