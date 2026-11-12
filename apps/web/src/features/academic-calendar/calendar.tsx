"use client";
import { useQueryState, parseAsInteger } from "nuqs";
import { useState } from "react";
import { AcademicEventForm } from "./event-form";
import Link from "next/link";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { schoolToday } from "~/features/class-records/calendar-model";
import { AcademicCalendarWorkshop } from "./workshop";

export function AcademicCalendar() {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [year, setYear] = useQueryState(
    "ano",
    parseAsInteger.withDefault(Number(schoolToday().slice(0, 4))),
  );
  const validYear = Math.min(2100, Math.max(2000, year));
  const query = trpc.calendar.academic.year.useQuery({ year: validYear });
  if (query.isPending)
    return (
      <p className="p-4" role="status">
        Carregando calendário acadêmico…
      </p>
    );
  if (query.error)
    return (
      <div className="p-4">
        <Alert>Não foi possível carregar o calendário.</Alert>
        <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    );
  return (
    <>
      {editing && (
        <AcademicEventForm
          item={query.data?.events.find((item) => item.id === editing)}
          onClose={() => setEditing(null)}
        />
      )}
      {creating && <AcademicEventForm onClose={() => setCreating(false)} />}
      <AcademicCalendarWorkshop
        data={query.data}
        onEditEvent={setEditing}
        activeYear={validYear}
        onYearChange={(value) => void setYear(Math.min(2100, Math.max(2000, value)))}
        actions={
          <>
            <Button size="sm" onClick={() => setCreating(true)}>
              Novo evento
            </Button>
            <Link href="/aulas" className="text-caption text-interactive">
              Agenda
            </Link>
          </>
        }
      />
    </>
  );
}
