"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Input } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { AppointmentBadge } from "~/features/appointments/shared";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { schoolToday, shiftDate } from "~/features/class-records/calendar-model";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";

const DEFAULT_RANGE_START_OFFSET = -30;
const DEFAULT_RANGE_END_OFFSET = 30;

export function TeacherAppointments(): ReactJSX.Element {
  const [from, setFrom] = useState(() => shiftDate(schoolToday(), DEFAULT_RANGE_START_OFFSET));
  const [through, setThrough] = useState(() => shiftDate(schoolToday(), DEFAULT_RANGE_END_OFFSET));
  const [selected, setSelected] = useState<string | null>(null);
  const query = trpc.appointments.list.useQuery(
    { from, through },
    { enabled: Boolean(from && through && from <= through) },
  );
  return (
    <TeacherPage
      title="Meus atendimentos"
      description="Consulte e registre os encontros atribuídos a você."
      back="/professor"
    >
      <AppointmentDateRange from={from} through={through} onFrom={setFrom} onThrough={setThrough} />
      <TeacherQueryState
        pending={query.isLoading}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && <AppointmentResults rows={query.data} onSelect={setSelected} />}
      {selected && (
        <StudentAppointmentDialog
          id={selected}
          admin={false}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
        />
      )}
    </TeacherPage>
  );
}

function AppointmentDateRange({
  from,
  through,
  onFrom,
  onThrough,
}: {
  from: string;
  through: string;
  onFrom: (value: string) => void;
  onThrough: (value: string) => void;
}): ReactJSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="grid gap-1 text-caption">
        De
        <Input type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      </label>
      <label className="grid gap-1 text-caption">
        Até
        <Input
          type="date"
          value={through}
          min={from}
          onChange={(event) => onThrough(event.target.value)}
        />
      </label>
    </div>
  );
}

function AppointmentResults({
  rows,
  onSelect,
}: {
  rows: RouterOutputs["appointments"]["list"];
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted"
          onClick={() => onSelect(row.id)}
        >
          <span className="min-w-0 text-sm font-semibold">
            {row.student.name}
            <span className="mt-1 block text-caption font-normal text-muted-foreground">
              {formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}
            </span>
          </span>
          <AppointmentBadge
            status={row.status}
            overdue={row.overdue}
            rescheduled={Boolean(row.rescheduledToId)}
          />
        </button>
      ))}
      {rows.length === 0 && (
        <p className="p-6 text-sm text-muted-foreground">Nenhum atendimento neste período.</p>
      )}
    </div>
  );
}
