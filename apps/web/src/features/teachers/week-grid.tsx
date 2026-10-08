"use client";
import { MeetingBlock } from "./meeting-block";
import type { Meeting } from "./meeting-dialog";
import { dateLabel, shiftDay } from "./format";
import { dayGroups, hourSegments } from "./week-layout";
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export function WeekGrid({
  rows,
  week,
  teacherId,
  onOpen,
}: {
  rows: Meeting[];
  week: string;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
}) {
  const days = DAYS.map((name, index) => ({
    name,
    date: shiftDay(week, index),
    groups: dayGroups(rows.filter((row) => row.date === shiftDay(week, index))),
  }));
  const boundaries = [
    ...new Set(
      rows.flatMap((row) => hourSegments(row).flatMap((segment) => [segment.start, segment.end])),
    ),
  ].sort();
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-border xl:block">
        <table
          className="w-full table-fixed border-collapse text-left"
          aria-label="Semana de aulas"
        >
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="w-20 p-3 text-caption font-normal text-muted-foreground">
                Horário
              </th>
              {days.map((day) => (
                <th key={day.date} scope="col" className="border-l border-border p-3">
                  <span className="block text-control font-medium">{day.name}</span>
                  <span className="font-numeric text-caption font-normal text-muted-foreground">
                    {dateLabel(day.date).slice(0, 5)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boundaries.slice(0, -1).map((time, index) => (
              <tr key={time}>
                <th
                  scope="row"
                  className="border-t border-border p-2 align-top font-numeric text-caption font-normal text-muted-foreground"
                >
                  {time}
                </th>
                {days.map((day) => {
                  const group = day.groups.find((item) => item.start <= time && item.end > time);
                  if (group && group.start !== time) return null;
                  const span = group ? boundaries.indexOf(group.end) - index : 1;
                  return (
                    <td
                      key={day.date}
                      rowSpan={span}
                      className="h-14 border-t border-l border-border p-1.5 align-top"
                    >
                      {group && (
                        <div className="grid gap-1.5">
                          {group.meetings.map((meeting) => (
                            <MeetingBlock
                              key={`${meeting.slotId ?? meeting.sessionId}:${meeting.date}`}
                              meeting={meeting}
                              teacherId={teacherId}
                              onOpen={onOpen}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-5 xl:hidden">
        {days.map((day) => (
          <section
            key={day.date}
            aria-label={`${day.name}, ${dateLabel(day.date)}`}
            className="grid gap-2"
          >
            <h3 className="flex items-baseline justify-between border-b border-border pb-2 text-control font-semibold">
              {day.name}
              <span className="font-numeric text-caption font-normal text-muted-foreground">
                {dateLabel(day.date)}
              </span>
            </h3>
            {day.groups.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {day.groups
                  .flatMap((group) => group.meetings)
                  .map((meeting) => (
                    <MeetingBlock
                      key={`${meeting.slotId ?? meeting.sessionId}:${meeting.date}`}
                      meeting={meeting}
                      teacherId={teacherId}
                      onOpen={onOpen}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground">Sem compromissos</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
