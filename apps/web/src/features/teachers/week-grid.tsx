"use client";
import { type MeetingGroup, dayGroups, visibleWeekSlots } from "./week-layout";
import type { ReactElement } from "react";
import { cn } from "@lazuli/ui";
import { MeetingBlock } from "./meeting-block";
import type { Meeting } from "./meeting-dialog";
import { dateLabel, shiftDay } from "./format";

const DATE_MONTH_OFFSET = 5;

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export function WeekGrid({ rows, week, teacherId, today, onOpen }: WeekGridInput): ReactElement {
  const days = DAYS.map((name, index) => ({
    name,
    date: shiftDay(week, index),
    groups: dayGroups(rows.filter((row) => row.date === shiftDay(week, index))),
  }));
  const slots = visibleWeekSlots(rows);
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-border bg-card xl:block">
        <table
          className="w-full table-fixed border-collapse text-left"
          aria-label="Semana de aulas"
        >
          <WeekHead days={days} today={today} />
          <tbody>
            {slots.map(({ start: time, end }) => (
              <WeekHour time={time} days={days} end={end} teacherId={teacherId} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 xl:hidden">
        {days.map((day) => (
          <WeekDay day={day} today={today} teacherId={teacherId} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

type WeekCellProps = {
  day: { name: string; date: string; groups: MeetingGroup[] };
  meetings: Meeting[];
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
};
function WeekCell(props: WeekCellProps): ReactElement {
  return (
    <td
      key={props.day.date}
      className={cn(
        "relative h-9 border-t border-l border-border-subtle p-0 align-top",
        props.meetings.length === 0 && "bg-muted/20",
      )}
    >
      {props.meetings.length > 0 && (
        <div className="absolute inset-0 flex flex-col">
          {props.meetings.map((meeting) => (
            <MeetingBlock
              key={`${meeting.slotId ?? meeting.sessionId}:${meeting.date}`}
              compact
              meeting={meeting}
              teacherId={props.teacherId}
              onOpen={props.onOpen}
            />
          ))}
        </div>
      )}
    </td>
  );
}

type WeekHeadProps = {
  days: { name: string; date: string; groups: MeetingGroup[] }[];
  today: string;
};
function WeekHead(props: WeekHeadProps): ReactElement {
  return (
    <thead>
      <tr className="border-b border-table-heading-border bg-table-heading text-table-heading-foreground">
        <th
          scope="col"
          className="w-14 px-2 py-1 text-caption font-normal text-table-heading-foreground"
        >
          Horário
        </th>
        {props.days.map((day) => (
          <th
            key={day.date}
            scope="col"
            aria-current={day.date === props.today ? "date" : undefined}
            className={cn(
              "border-l border-border px-2 py-1",
              day.date === props.today &&
                "border-b-2 border-b-selection-indicator bg-accent text-accent-foreground",
            )}
          >
            <span className="inline-flex items-baseline gap-1 text-caption font-medium">
              {day.name}
              <span aria-hidden="true">·</span>
              <span className="font-numeric font-normal">
                {dateLabel(day.date).slice(0, DATE_MONTH_OFFSET)}
              </span>
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

type WeekHourProps = {
  time: string;
  days: { name: string; date: string; groups: MeetingGroup[] }[];
  end: string;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
};
function WeekHour(props: WeekHourProps): ReactElement {
  return (
    <tr key={props.time} className="h-9">
      <th
        scope="row"
        className="border-t border-border-subtle px-2 py-0.5 align-top font-numeric text-caption font-normal text-muted-foreground"
      >
        {props.time}
      </th>
      {props.days.map((day) => {
        const meetings = day.groups
          .flatMap((group) => group.meetings)
          .filter((meeting) => meeting.startTime < props.end && meeting.endTime > props.time);
        return (
          <WeekCell
            key={day.date}
            day={day}
            meetings={meetings}
            teacherId={props.teacherId}
            onOpen={props.onOpen}
          />
        );
      })}
    </tr>
  );
}

type WeekDayProps = {
  day: { name: string; date: string; groups: MeetingGroup[] };
  today: string;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
};
function WeekDay(props: WeekDayProps): ReactElement {
  return (
    <section
      key={props.day.date}
      aria-label={`${props.day.name}, ${dateLabel(props.day.date)}`}
      className="grid gap-2"
    >
      <h3
        className={cn(
          "flex items-baseline gap-1.5 border-b border-border px-2 py-1 text-control font-semibold",
          props.day.date === props.today &&
            "border-selection-indicator bg-accent text-accent-foreground",
        )}
        aria-current={props.day.date === props.today ? "date" : undefined}
      >
        {props.day.name}
        <span aria-hidden="true">·</span>
        <span className="font-numeric text-caption font-normal">
          {dateLabel(props.day.date).slice(0, DATE_MONTH_OFFSET)}
        </span>
      </h3>
      {props.day.groups.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {props.day.groups
            .flatMap((group) => group.meetings)
            .map((meeting) => (
              <MeetingBlock
                key={`${meeting.slotId ?? meeting.sessionId}:${meeting.date}`}
                meeting={meeting}
                teacherId={props.teacherId}
                onOpen={props.onOpen}
              />
            ))}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">Sem compromissos</p>
      )}
    </section>
  );
}

type WeekGridInput = {
  rows: Meeting[];
  week: string;
  teacherId: string;
  today: string;
  onOpen: (meeting: Meeting) => void;
};
