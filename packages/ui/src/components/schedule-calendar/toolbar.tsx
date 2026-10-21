import type { ReactElement } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../button";
import { SegmentedControl, SegmentedControlItem } from "../segmented-control";
import { ScheduleCalendarDatePicker } from "../schedule-calendar-date-picker";
import { calendarDateKey, zonedNow } from "./model";
import type { ScheduleCalendarProps } from "./types";

import { getScheduleCalendarNavigation } from "./date-window";
function CalendarNavigation(props: ScheduleCalendarProps): ReactElement {
  const today = calendarDateKey(zonedNow(props.timeZone ?? "America/Sao_Paulo"));
  const navigation = getScheduleCalendarNavigation(props, today);
  return (
    <div className="lz-calendar-navigation">
      <NavigationDatePicker props={props} today={today} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={props.view === "day" ? "Dia anterior" : "Período anterior"}
        disabled={navigation.previousDate === null}
        onClick={() => navigation.previousDate && props.onDateChange(navigation.previousDate)}
      >
        <ChevronLeft />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={navigation.todayDate === null}
        onClick={() => navigation.todayDate && props.onDateChange(navigation.todayDate)}
      >
        Hoje
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={props.view === "day" ? "Próximo dia" : "Próximo período"}
        disabled={navigation.nextDate === null}
        onClick={() => navigation.nextDate && props.onDateChange(navigation.nextDate)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
export function CalendarToolbar(props: ScheduleCalendarProps): ReactElement {
  return (
    <div className="lz-calendar-toolbar">
      <CalendarNavigation {...props} />
      {props.filters}
      <div className="lz-calendar-actions">
        {props.actions}
        <SegmentedControl
          size="sm"
          aria-label="Visualização da agenda"
          value={props.view}
          onValueChange={(view) => {
            if (view === "day" || view === "week") props.onViewChange(view);
          }}
        >
          <SegmentedControlItem value="day">Dia</SegmentedControlItem>
          <SegmentedControlItem value="week">
            {props.dayCount === undefined
              ? "Semana"
              : `${props.dayCount} ${props.dayCount === 1 ? "dia" : "dias"}`}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
    </div>
  );
}

function NavigationDatePicker({
  props,
  today,
}: {
  props: ScheduleCalendarProps;
  today: string;
}): ReactElement {
  return (
    <ScheduleCalendarDatePicker
      trigger={
        props.dateLabel ? (
          <Button type="button" variant="ghost" size="sm">
            {props.dateLabel}
            <ChevronDown aria-hidden="true" />
          </Button>
        ) : undefined
      }
      date={props.date}
      today={today}
      minDate={props.minDate}
      maxDate={props.maxDate}
      onChange={props.onDateChange}
    />
  );
}
