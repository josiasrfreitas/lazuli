"use client";
import { useId, type CSSProperties, type ReactElement } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../button";
import { CalendarGrid } from "./grid";
import { calendarRangeDates, getScheduleCalendarRange } from "./date-window";
import {
  CalendarBlock,
  CalendarBlockWrapper,
  CalendarInteraction,
  type Interaction,
} from "./interaction";
import {
  gridBehavior,
  gridTimes,
  useCalendarSurface,
  type SurfaceProps,
  type SurfaceLayout,
} from "./surface-model";
import type { WeeklyBlock } from "./weekly-blocks";
import { weeklyLaneGeometry } from "./weekly-layout";
import { useExpandedDayGrow } from "./use-expanded-day-grow";
const TIME_AXIS_WIDTH = 52;
const EVENT_MIN_WIDTH = 164;
const PERCENT = 100;
const components = { event: CalendarBlock, eventWrapper: CalendarBlockWrapper };

function interaction(
  props: SurfaceProps,
  layout: SurfaceLayout,
  expandedDayWidth: number,
): Interaction {
  return {
    expandedId: layout.activeId,
    expandedDayWidth,
    selectedId: props.selectedEventId,
    view: props.view,
    keepExpanded: Boolean(props.keepExpanded),
    expand:
      props.rangeSelection || props.expandEvents === false
        ? (id: string | null) => {
            if (id === null) layout.hover.expand(null);
          }
        : layout.hover.expand,
    onOpen: (event: Parameters<NonNullable<SurfaceProps["onEventActivate"]>>[0]) =>
      props.onEventActivate?.(event),
    renderEvent: props.renderEvent,
    onOverflow: (event: WeeklyBlock, keyboard: boolean) => {
      layout.hover.expand(event.id, !keyboard);
      if (!keyboard) return;
      requestAnimationFrame(() =>
        layout.timelineRef.current
          ?.querySelector<HTMLButtonElement>('[data-expanded="true"] button')
          ?.focus(),
      );
    },
  };
}
export function CalendarSurface(props: SurfaceProps): ReactElement {
  const layout = useCalendarSurface(props);
  const range = getScheduleCalendarRange(props);
  const dayCount = calendarRangeDates(range).length;
  const scope = useId().replaceAll(":", "");
  const dailyWidth =
    TIME_AXIS_WIDTH +
    Math.max(1, ...layout.displayed.map((block) => block.columns)) * EVENT_MIN_WIDTH;
  const { view, density = "comfortable", status = "ready" } = props;
  const expanded = layout.displayed.find((block) => block.id === layout.activeId);
  const preferredWidth = props.expandedEventWidth;
  // Include neighboring lanes so the requested width belongs to the expanded card.
  const expandedDayWidth = expanded?.revealed
    ? expanded.columns * EVENT_MIN_WIDTH
    : preferredDayWidth({ view, expanded, preferredWidth });
  const expandedDayGrow = useExpandedDayGrow(layout.timelineRef, view, expandedDayWidth, dayCount);
  return (
    <CalendarInteraction value={interaction(props, layout, expandedDayGrow.width)}>
      <div
        className="lz-calendar-viewport"
        role="region"
        aria-label={props.label ?? (view === "day" ? "Agenda diária" : "Agenda semanal")}
        tabIndex={0}
        ref={layout.timelineRef}
        onPointerMove={layout.hover.onPointerMove}
        onPointerLeave={layout.hover.onPointerLeave}
        data-calendar-layout={scope}
        data-view={view}
        data-density={density}
        style={{ "--lz-calendar-day-count": dayCount } as CSSProperties}
      >
        {view === "day" && (
          <style>{`[data-calendar-layout="${scope}"] > .lz-week-calendar { min-width: ${dailyWidth}px; }`}</style>
        )}
        {view === "week" && dayCount !== 7 && (
          <style>{`.lz-calendar-viewport[data-calendar-layout="${scope}"][data-view="week"][data-density="${density}"] > .lz-week-calendar { min-width: ${TIME_AXIS_WIDTH + dayCount * (density === "compact" ? 84 : 203)}px; }`}</style>
        )}
        {view === "week" && (
          <style>{`
            .lz-calendar-viewport[data-calendar-layout="${scope}"] .rbc-header,
            .lz-calendar-viewport[data-calendar-layout="${scope}"] .rbc-day-slot {
              max-width: none;
            }
            .lz-calendar-viewport[data-calendar-layout="${scope}"] .rbc-header.lz-calendar-expanded-day,
            .lz-calendar-viewport[data-calendar-layout="${scope}"] .rbc-day-slot.lz-calendar-expanded-day {
              flex-grow: ${expandedDayGrow.grow};
            }
          `}</style>
        )}
        <CalendarGrid<WeeklyBlock>
          view={view}
          range={range}
          density={density}
          loading={status === "loading"}
          events={status === "error" ? [] : layout.displayed}
          components={components}
          {...gridTimes(props)}
          {...gridBehavior(props, layout)}
        />
        {status === "error" && (
          <div className="lz-calendar-state" role="alert">
            <p>{props.errorMessage ?? "Não foi possível carregar a agenda."}</p>
            {props.onRetry && (
              <Button type="button" variant="secondary" size="sm" onClick={props.onRetry}>
                <RefreshCw />
                Tentar novamente
              </Button>
            )}
          </div>
        )}
      </div>
    </CalendarInteraction>
  );
}

function preferredDayWidth({
  view,
  expanded,
  preferredWidth,
}: {
  view: SurfaceProps["view"];
  expanded: WeeklyBlock | undefined;
  preferredWidth: number | undefined;
}): number | null {
  if (
    view !== "week" ||
    !expanded ||
    !preferredWidth ||
    !Number.isFinite(preferredWidth) ||
    preferredWidth <= 0
  )
    return null;
  return ((preferredWidth + 2) * PERCENT) / weeklyLaneGeometry(expanded, expanded).width;
}
