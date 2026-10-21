import type { ReactElement } from "react";
import { CalendarSelectionFields } from "./selection-fields";
import type { CalendarInterval, ScheduleCalendarProps } from "./types";
import { getScheduleCalendarRange } from "./date-window";
function isEmpty(props: ScheduleCalendarProps): boolean {
  const { from, through } = getScheduleCalendarRange(props);
  return !props.events.some((event) => event.date >= from && event.date <= through);
}
function EmptyMessage(props: ScheduleCalendarProps): ReactElement | null {
  if ((props.status && props.status !== "ready") || !isEmpty(props) || props.rangeSelection?.value)
    return null;
  const fallback = props.rangeSelection
    ? "Sem compromissos visíveis neste período. Escolha um horário livre."
    : "Nenhum compromisso neste período.";
  return (
    <p className="lz-calendar-empty" role="status">
      {props.emptyMessage ?? fallback}
    </p>
  );
}
export function CalendarFooter({
  props,
  message,
  onSelect,
}: {
  props: ScheduleCalendarProps;
  message: string | undefined;
  onSelect: (range: CalendarInterval) => void;
}): ReactElement {
  const selection = props.rangeSelection;
  const ready = !props.status || props.status === "ready";
  return (
    <>
      <EmptyMessage {...props} />
      {selection &&
        (selection.controls ?? (
          <CalendarSelectionFields
            key={selectionKey(props)}
            date={props.date}
            minDate={props.minDate}
            maxDate={props.maxDate}
            selection={selection}
            disabled={!ready}
            onSelect={onSelect}
          />
        ))}
      {selection && message && (
        <p className="lz-calendar-feedback" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function selectionKey(props: ScheduleCalendarProps): string {
  const value = props.rangeSelection?.value;
  return [props.date, value?.date, value?.startTime, value?.endTime].join(":");
}
