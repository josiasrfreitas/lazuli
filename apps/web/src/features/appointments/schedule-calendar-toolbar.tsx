import type { ReactElement } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  getScheduleCalendarNavigation,
  ScheduleCalendarDatePicker,
  SegmentedControl,
  SegmentedControlItem,
  type CalendarView,
  type SearchSelectOption,
} from "@lazuli/ui";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import styles from "./class-meeting-step.module.css";

type ToolbarProps = {
  date: string;
  today: string;
  view: CalendarView;
  teacher: SearchSelectOption | null;
  onDateChange: (value: string) => void;
  onViewChange: (value: CalendarView) => void;
  onTeacherChange: (value: SearchSelectOption | null) => void;
};

export function ScheduleCalendarToolbar(props: ToolbarProps): ReactElement {
  return (
    <div className={styles.toolbar}>
      <div className={styles.teacher}>
        <TeacherPicker
          showSearchIcon
          date={props.date}
          value={props.teacher}
          onChange={props.onTeacherChange}
        />
      </div>
      <CalendarNavigation {...props} />
      <CalendarViews {...props} />
    </div>
  );
}

function CalendarNavigation({ date, today, view, onDateChange }: ToolbarProps): ReactElement {
  const navigation = getScheduleCalendarNavigation(
    { date, view, dayCount: 7, minDate: today },
    today,
  );
  return (
    <div className={styles.navigation} aria-label="Período da agenda">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={view === "week" ? "Sete dias anteriores" : "Dia anterior"}
        disabled={navigation.previousDate === null}
        onClick={() => navigation.previousDate && onDateChange(navigation.previousDate)}
      >
        <ChevronLeft />
      </Button>
      <ToolbarDatePicker date={date} today={today} view={view} onDateChange={onDateChange} />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={view === "week" ? "Próximos sete dias" : "Próximo dia"}
        disabled={navigation.nextDate === null}
        onClick={() => navigation.nextDate && onDateChange(navigation.nextDate)}
      >
        <ChevronRight />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onDateChange(today)}>
        <CalendarDays aria-hidden="true" />
        Hoje
      </Button>
    </div>
  );
}

function ToolbarDatePicker({
  date,
  today,
  view,
  onDateChange,
}: Pick<ToolbarProps, "date" | "today" | "view" | "onDateChange">): ReactElement {
  return (
    <ScheduleCalendarDatePicker
      date={date}
      today={today}
      minDate={today}
      onChange={onDateChange}
      trigger={
        view === "day" ? (
          <Button type="button" size="sm" variant="ghost">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })
              .format(new Date(`${date}T12:00:00Z`))
              .replace(/^./, (letter) => letter.toUpperCase())}
            <ChevronDown aria-hidden="true" />
          </Button>
        ) : undefined
      }
    />
  );
}

function CalendarViews({ view, onViewChange }: ToolbarProps): ReactElement {
  return (
    <div className={styles.views}>
      <SegmentedControl
        size="sm"
        aria-label="Visualização da agenda"
        value={view}
        onValueChange={(value) => {
          if (value === "day" || value === "week") onViewChange(value);
        }}
      >
        <SegmentedControlItem value="day">Dia</SegmentedControlItem>
        <SegmentedControlItem value="week">7 dias</SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}
