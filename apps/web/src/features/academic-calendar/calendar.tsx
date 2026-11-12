"use client";
import { CalendarManagement, type CalendarEditor } from "./management";
import { CalendarChangeForm } from "./change-form";
import { CalendarHolidays } from "./holidays";
import { CalendarProcessing } from "./processing";
import { useState } from "react";
import { AcademicEventForm } from "./event-form";
import Link from "next/link";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { AcademicCalendarWorkshop } from "./workshop";
import { useAcademicCalendarNavigation } from "./navigation";

export function AcademicCalendar() {
  const [managing, setManaging] = useState(false);
  const [editor, setEditor] = useState<CalendarEditor | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigation = useAcademicCalendarNavigation();
  const query = trpc.calendar.academic.year.useQuery(
    { year: navigation.year },
    {
      refetchInterval: (query) =>
        query.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? 3000
          : false,
    },
  );
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
      {managing && query.data && (
        <CalendarManagement
          data={query.data}
          year={navigation.year}
          onClose={() => setManaging(false)}
          onEdit={(value) => {
            setManaging(false);
            setEditor(value);
          }}
        />
      )}
      {editor && editor.kind !== "holidays" && (
        <CalendarChangeForm
          mode={editor.kind}
          item={
            editor.kind === "period"
              ? query.data?.periods.find((row) => row.id === editor.id)
              : query.data?.interruptions.find((row) => row.id === editor.id)
          }
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === "holidays" && query.data && (
        <CalendarHolidays
          year={navigation.year}
          data={query.data}
          onClose={() => setEditor(null)}
        />
      )}
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
        notice={
          query.data && (
            <CalendarProcessing
              requests={query.data.requests}
              planWarnings={query.data.planWarnings}
            />
          )
        }
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setManaging(true)}>
              Configurar
            </Button>
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
