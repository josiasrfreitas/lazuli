import {
  createContext,
  useContext,
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import type { EventProps, EventWrapperProps } from "react-big-calendar";
import type { CalendarEvent, CalendarEventRenderContext, CalendarView } from "./types";
import type { WeeklyBlock } from "./weekly-blocks";
import { calendarCardNeedsExpansion } from "./content-fit";
import { weeklyLaneGeometry } from "./weekly-layout";

export type Interaction = {
  expandedId: string | null;
  expandedDayWidth?: number;
  selectedId: string | null | undefined;
  view: CalendarView;
  keepExpanded: boolean;
  expand: (id: string | null, pointer?: boolean) => void;
  onOpen: (event: CalendarEvent) => void;
  onOverflow: (event: WeeklyBlock, keyboard: boolean) => void;
  renderEvent?:
    | ((event: CalendarEvent, context: CalendarEventRenderContext) => ReactNode)
    | undefined;
};
export const CalendarInteraction = createContext<Interaction | null>(null);
function useInteraction(): Interaction {
  const value = useContext(CalendarInteraction);
  if (!value) throw new Error("ScheduleCalendar interaction provider is required");
  return value;
}
export function CalendarBlock({ event }: EventProps<WeeklyBlock>): ReactNode {
  const interaction = useInteraction();
  const item = event.lessons[0]!;
  if (!item) return <span className="lz-calendar-background-label">{event.title}</span>;
  const expanded = interaction.expandedId === event.id || Boolean(event.revealed);
  if (event.kind === "overflow")
    return (
      <button
        type="button"
        className="lz-calendar-overflow"
        aria-label={`${event.lessons.length} outros compromissos, ${event.startTime}–${event.endTime}`}
        onClick={(click) => interaction.onOverflow(event, click.detail === 0)}
      >
        <strong>+{event.lessons.length}</strong>
        <span>Mais</span>
      </button>
    );
  const context: CalendarEventRenderContext = {
    view: interaction.view,
    expanded,
    ...(interaction.view === "week" && expanded && !event.revealed
      ? {
          expandedDayWidth: interaction.expandedDayWidth,
          expandedWidthShare: weeklyLaneGeometry(event, event).width / 100,
        }
      : {}),
    selected: item.id === interaction.selectedId,
    disabled: Boolean(item.disabled),
    activate: () => {
      if (!item.disabled) interaction.onOpen(item);
    },
    toggleExpanded: () => interaction.expand(expanded ? null : event.id),
  };
  if (interaction.renderEvent) return interaction.renderEvent(item, context);
  return <DefaultCalendarEvent item={item} context={context} />;
}
function DefaultCalendarEvent({
  item,
  context,
}: {
  item: CalendarEvent;
  context: CalendarEventRenderContext;
}): ReactNode {
  return (
    <button
      type="button"
      className="lz-calendar-event"
      data-tone={item.tone ?? "neutral"}
      aria-pressed={context.selected}
      aria-disabled={item.disabled}
      aria-label={eventLabel(item)}
      title={item.disabledReason ?? item.description}
      onClick={context.activate}
    >
      <span className="lz-calendar-event-time" data-calendar-detail>
        {item.startTime}–{item.endTime}
      </span>
      <strong className="lz-calendar-event-title" data-calendar-detail>
        {item.title}
      </strong>
      {item.subtitle && (
        <span className="lz-calendar-event-subtitle" data-calendar-detail>
          {item.subtitle}
        </span>
      )}
      {item.description && (
        <span className="lz-calendar-event-description" data-calendar-detail>
          {item.description}
        </span>
      )}
    </button>
  );
}
export function CalendarBlockWrapper({
  event,
  children,
}: EventWrapperProps<WeeklyBlock> & {
  children?: ReactElement<HTMLAttributes<HTMLElement>>;
}): ReactElement | null {
  const { expandedId, expand, keepExpanded, view } = useInteraction();
  if (!children) return null;
  const expanded = expandedId === event.id || Boolean(event.revealed);
  const attributes = {
    "data-week-group": event.groupId,
    "data-week-id": event.id,
    "data-week-lane": event.lane,
    "data-week-columns": event.columns,
    "data-week-revealed": event.revealed,
    "data-expanded": expanded,
  };
  return cloneElement(children, {
    ...attributes,
    role: "group",
    tabIndex: undefined,
    title: undefined,
    "aria-label": event.title,
    onClick: undefined,
    onKeyDown: (key) => {
      if (key.key !== "Escape" || !expanded) return;
      key.stopPropagation();
      key.currentTarget.closest<HTMLElement>('[role="region"]')?.focus();
      expand(null);
    },
    onFocusCapture: (focus) => {
      if (
        view === "week" &&
        event.kind !== "overflow" &&
        focus.target.matches(":focus-visible") &&
        calendarCardNeedsExpansion(focus.currentTarget)
      )
        expand(event.id);
    },
    onBlurCapture: (focus) => {
      if (expanded && !keepExpanded && focusLeavesGroup(focus.currentTarget, focus.relatedTarget))
        expand(null);
    },
  });
}

function eventLabel(event: CalendarEvent): string {
  return [event.title, event.subtitle, `${event.startTime}–${event.endTime}`, event.disabledReason]
    .filter(Boolean)
    .join(" · ");
}

function focusLeavesGroup(current: HTMLElement, next: EventTarget | null): boolean {
  return !(
    next instanceof Element &&
    next.closest<HTMLElement>("[data-week-group]")?.dataset.weekGroup === current.dataset.weekGroup
  );
}
