"use client";
import { Alert, Button } from "@lazuli/ui";
import { CalendarHolidays } from "~/features/academic-calendar/holidays";
import { trpc } from "~/lib/trpc";
import type { OrganizationDialogProps } from "./dialogs";
export function HolidayForm({ board, onClose }: OrganizationDialogProps) {
  const year = board.semester.startDate.getUTCFullYear();
  const query = trpc.calendar.academic.year.useQuery({ year });
  if (query.isPending) return <p role="status">Carregando calendário…</p>;
  if (query.error || !query.data)
    return (
      <Alert>
        Não foi possível carregar o calendário.{" "}
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Voltar
        </Button>
      </Alert>
    );
  return <CalendarHolidays year={year} data={query.data} onClose={onClose} />;
}
