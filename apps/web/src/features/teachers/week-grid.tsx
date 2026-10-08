"use client";
import { cn } from "@lazuli/ui";
import { MeetingBlock } from "./meeting-block";
import type { Meeting } from "./meeting-dialog";
import { dateLabel, shiftDay } from "./format";
import { dayGroups, visibleWeekSlots } from "./week-layout";
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export function WeekGrid({
  rows,
  week,
  teacherId,
  today,
  onOpen,
}: {
  rows: Meeting[];
  week: string;
  teacherId: string;
  today: string;
  onOpen: (meeting: Meeting) => void;
}) {
  const days = DAYS.map((name, index) => ({
    name,
    date: shiftDay(week, index),
    groups: dayGroups(rows.filter((row) => row.date === shiftDay(week, index))),
  }));
  const slots = visibleWeekSlots(rows);
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-border xl:block">
        <table
          className="w-full table-fixed border-collapse text-left"
          aria-label="Semana de aulas"
        >
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="w-14 px-2 py-1 text-caption font-normal text-muted-foreground">
                Horário
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  scope="col"
                  aria-current={day.date === today ? "date" : undefined}
                  className={cn(
                    "border-l border-border px-2 py-1",
                    day.date === today && "bg-accent",
                  )}
                >
                  <span className="inline-flex items-baseline gap-1 text-caption font-medium">
                    {day.name}
                    <span aria-hidden="true">·</span>
                    <span className="font-numeric font-normal">
                      {dateLabel(day.date).slice(0, 5)}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map(({ start: time, end }) => (
              <tr key={time} className="h-9">
                <th
                  scope="row"
                  className="border-t border-border px-2 py-0.5 align-top font-numeric text-caption font-normal text-muted-foreground"
                >
                  {time}
                </th>
                {days.map((day) => {
                  const meetings = day.groups
                    .flatMap((group) => group.meetings)
                    .filter((meeting) =>
                      meeting.startTime < end && meeting.endTime > time,
                    );
                  return (
                    <td
                      key={day.date}
                      className={cn(
                        "relative h-9 border-t border-l border-border p-0 align-top",
                        meetings.length === 0 && "bg-muted/20",
                      )}
                    >
                      {meetings.length > 0 && (
                        <div className="absolute inset-0 flex flex-col">
                          {meetings.map((meeting) => (
                            <MeetingBlock
                              key={`${meeting.slotId ?? meeting.sessionId}:${meeting.date}`}
                              compact
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
      <div className="grid gap-4 xl:hidden">
        {days.map((day) => (
          <section
            key={day.date}
            aria-label={`${day.name}, ${dateLabel(day.date)}`}
            className="grid gap-2"
          >
            <h3
              className={cn(
                "flex items-baseline gap-1.5 border-b border-border px-2 py-1 text-control font-semibold",
                day.date === today && "bg-accent text-accent-foreground",
              )}
              aria-current={day.date === today ? "date" : undefined}
            >
              {day.name}
              <span aria-hidden="true">·</span>
              <span className="font-numeric text-caption font-normal">
                {dateLabel(day.date).slice(0, 5)}
              </span>
            </h3>
            {day.groups.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
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
