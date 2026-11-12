"use client";
import { useState } from "react";
import { AcademicEventForm } from "./event-form";
import Link from "next/link";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { AcademicCalendarWorkshop } from "./workshop";
import { useAcademicCalendarNavigation } from "./navigation";

export function AcademicCalendar() {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigation = useAcademicCalendarNavigation();
  const query = trpc.calendar.academic.year.useQuery({ year: navigation.year });
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
        activeYear={navigation.year}
        onYearChange={navigation.setYear}
        location={navigation.location}
        onLocationChange={navigation.setLocation}
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
