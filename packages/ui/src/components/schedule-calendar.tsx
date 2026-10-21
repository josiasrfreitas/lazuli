"use client";
import { useEffect, useState, type ReactElement } from "react";
import { cn } from "../lib/utils";
import { PencilLoader } from "./pencil-loader";
import { CalendarSurface } from "./schedule-calendar/surface";
import { CalendarToolbar } from "./schedule-calendar/toolbar";
import { CalendarFooter } from "./schedule-calendar/footer";
import type {
  CalendarEvent,
  CalendarInterval,
  ScheduleCalendarProps,
} from "./schedule-calendar/types";
import { selectionError } from "./schedule-calendar/model";
export {
  getScheduleCalendarRange,
  getScheduleCalendarNavigation,
} from "./schedule-calendar/date-window";
import {
  calendarDateError,
  clampCalendarDate,
  getScheduleCalendarRange,
} from "./schedule-calendar/date-window";
export type {
  CalendarDateRange,
  CalendarDateWindow,
  CalendarView,
  CalendarEvent,
  CalendarInterval,
  CalendarBlockedInterval,
  CalendarRangeSelection,
  CalendarEventRenderContext,
  ScheduleCalendarProps,
} from "./schedule-calendar/types";

function adaptEvents<Event extends CalendarEvent>(
  props: ScheduleCalendarProps<Event>,
): ScheduleCalendarProps {
  const source = new Map(props.events.map((event) => [event.id, event]));
  // Layout sees only the shared event contract. Renderers/callbacks retain the original event type.
  return {
    ...props,
    onEventActivate: (event) => {
      const original = source.get(event.id);
      if (original) props.onEventActivate?.(original);
    },
    ...(props.renderEvent
      ? {
          renderEvent: (event, context) => {
            const original = source.get(event.id);
            return original ? props.renderEvent?.(original, context) : null;
          },
        }
      : { renderEvent: undefined }),
  };
}
export function ScheduleCalendar<Event extends CalendarEvent>(
  props: ScheduleCalendarProps<Event>,
): ReactElement {
  const [message, setMessage] = useState<string>();
  const selected = props.rangeSelection?.value;
  useEffect(
    () => setMessage(undefined),
    [props.date, props.view, selected?.date, selected?.startTime, selected?.endTime],
  );
  const status = props.status ?? "ready";
  const range = getScheduleCalendarRange(props);
  const selection = props.rangeSelection && {
    ...props.rangeSelection,
    getError: (value: CalendarInterval) =>
      calendarDateError(value.date, props) ?? props.rangeSelection?.getError?.(value),
  };
  const surface = adaptEvents({
    ...props,
    date: clampCalendarDate(props.date, props),
    rangeSelection: selection,
    onDateChange: (date) => props.onDateChange(clampCalendarDate(date, props)),
  });
  function select(range: CalendarInterval): void {
    if (!selection || status !== "ready") return;
    const error = selectionError(range, selection);
    setMessage(error);
    if (!error) selection.onSelect(range);
  }
  const feedback =
    message ??
    (selected
      ? `Selecionado: ${selected.date.split("-").toReversed().join("/")}, ${selected.startTime}–${selected.endTime}.`
      : undefined);
  return (
    <div
      className={cn("lz-schedule-calendar", props.className)}
      data-density={props.density ?? "comfortable"}
    >
      {props.toolbar !== false && <CalendarToolbar {...surface} />}
      <div className="lz-calendar-frame">
        <CalendarSurface
          key={`${props.view}:${range.from}:${range.through}`}
          {...surface}
          onSelectRange={select}
          onRejected={setMessage}
        />
        {status === "loading" && (
          <div className="lz-calendar-loading">
            <PencilLoader label="Carregando agenda" />
          </div>
        )}
      </div>
      <CalendarFooter props={surface} message={feedback} onSelect={select} />
    </div>
  );
}
