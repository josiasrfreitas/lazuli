"use client";
import type { ReactElement } from "react";
import { cn, PencilLoader } from "@lazuli/ui";
import { visibleWeekSlots } from "./week-layout";
import { MeetingBlock, type AgendaSlot } from "./meeting-block";

const DAYS = [
  { weekday: "MONDAY", name: "Segunda" },
  { weekday: "TUESDAY", name: "Terça" },
  { weekday: "WEDNESDAY", name: "Quarta" },
  { weekday: "THURSDAY", name: "Quinta" },
  { weekday: "FRIDAY", name: "Sexta" },
  { weekday: "SATURDAY", name: "Sábado" },
  { weekday: "SUNDAY", name: "Domingo" },
];
type Day = { weekday: string; name: string; meetings: AgendaSlot[] };
type Slot = ReturnType<typeof visibleWeekSlots>[number];

export function WeekGrid({
  rows,
  back,
  loading = false,
}: {
  rows: AgendaSlot[];
  back: string;
  loading?: boolean;
}): ReactElement {
  const days = DAYS.map((day) => ({
    ...day,
    meetings: rows
      .filter((row) => row.weekday === day.weekday)
      .toSorted((left, right) => left.startTime.localeCompare(right.startTime)),
  }));
  const slots = visibleWeekSlots(rows);
  return (
    <>
      <DesktopGrid days={days} slots={slots} back={back} loading={loading} />
      <MobileGrid days={days} back={back} loading={loading} />
    </>
  );
}

function DesktopGrid({
  days,
  slots,
  back,
  loading,
}: {
  days: Day[];
  slots: Slot[];
  back: string;
  loading: boolean;
}): ReactElement {
  return (
    <div className="hidden overflow-hidden rounded-md border border-border bg-card xl:block">
      <table
        className="w-full table-fixed border-collapse text-left"
        aria-label="Agenda do professor"
      >
        <DesktopHeader days={days} />
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8}>
                <LoadingWeek />
              </td>
            </tr>
          ) : (
            slots.map((slot) => <DesktopRow key={slot.start} slot={slot} days={days} back={back} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function DesktopHeader({ days }: { days: Day[] }): ReactElement {
  return (
    <thead>
      <tr className="border-b border-table-heading-border bg-table-heading text-table-heading-foreground">
        <th
          scope="col"
          className="w-14 px-2 py-1 text-caption font-normal text-table-heading-foreground"
        >
          Horário
        </th>
        {days.map((day) => (
          <th
            key={day.weekday}
            scope="col"
            className="border-l border-border px-2 py-1 text-caption font-medium"
          >
            {day.name}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function DesktopRow({ slot, days, back }: { slot: Slot; days: Day[]; back: string }): ReactElement {
  return (
    <tr className="h-9">
      <th
        scope="row"
        className="border-t border-border-subtle px-2 py-0.5 align-top font-numeric text-caption font-normal text-muted-foreground"
      >
        {slot.start}
      </th>
      {days.map((day) => (
        <DesktopCell key={day.weekday} day={day} slot={slot} back={back} />
      ))}
    </tr>
  );
}

function DesktopCell({ day, slot, back }: { day: Day; slot: Slot; back: string }): ReactElement {
  const meetings = day.meetings.filter(
    (row) => row.startTime < slot.end && row.endTime > slot.start,
  );
  return (
    <td
      className={cn(
        "relative h-9 border-t border-l border-border-subtle p-0 align-top",
        meetings.length === 0 && "bg-muted/20",
      )}
    >
      {meetings.length > 0 && (
        <div className="absolute inset-0 flex flex-col">
          {meetings.map((meeting) => (
            <MeetingBlock key={meeting.id} meeting={meeting} compact back={back} />
          ))}
        </div>
      )}
    </td>
  );
}

function MobileGrid({
  days,
  back,
  loading,
}: {
  days: Day[];
  back: string;
  loading: boolean;
}): ReactElement {
  return (
    <div className="grid gap-4 xl:hidden">
      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-border bg-card">
          <PencilLoader label="Carregando agenda do professor" />
        </div>
      ) : (
        days.map((day) => <MobileDay key={day.weekday} day={day} back={back} />)
      )}
    </div>
  );
}

function MobileDay({ day, back }: { day: Day; back: string }): ReactElement {
  return (
    <section aria-label={day.name} className="grid gap-2">
      <h3 className="border-b border-border px-2 py-1 text-control font-semibold">{day.name}</h3>
      {day.meetings.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {day.meetings.map((meeting) => (
            <MeetingBlock key={meeting.id} meeting={meeting} back={back} />
          ))}
        </div>
      ) : (
        <p className="px-2 text-caption text-muted-foreground">Sem horários</p>
      )}
    </section>
  );
}

function LoadingWeek(): ReactElement {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <PencilLoader label="Carregando agenda do professor" />
    </div>
  );
}
