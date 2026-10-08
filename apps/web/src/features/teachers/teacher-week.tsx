import { ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, EmptyState, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, hoursLabel, mondayOf, shiftDay } from "./format";
import { WeekGrid } from "./week-grid";
import type { Meeting } from "./meeting-dialog";
export function TeacherWeek({
  id,
  week,
  today,
  onWeekChange,
  onOpen,
}: {
  id: string;
  week: string;
  today: string;
  onWeekChange: (week: string) => void;
  onOpen: (meeting: Meeting) => void;
}) {
  const schedule = trpc.teachers.week.useQuery({ id, week });
  return (
    <section className="grid gap-4" aria-label="Semana de aulas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-control font-semibold">Semana de aulas</h2>
          <p className="font-numeric text-caption text-muted-foreground">
            {dateLabel(week)} a {dateLabel(shiftDay(week, 6))}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
          <div className="text-left sm:text-right">
            <p className="font-numeric text-h3 font-semibold tabular-nums">
              {schedule.data && !schedule.isFetching ? (
                hoursLabel(schedule.data.minutes)
              ) : (
                <InlineSkeleton />
              )}
            </p>
            <p className="text-caption text-muted-foreground">horas-aula previstas</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon-compact-responsive"
              aria-label="Semana anterior"
              onClick={() => onWeekChange(shiftDay(week, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="compact-responsive"
              onClick={() => onWeekChange(mondayOf(today))}
            >
              Hoje
            </Button>
            <Button
              variant="secondary"
              size="icon-compact-responsive"
              aria-label="Próxima semana"
              onClick={() => onWeekChange(shiftDay(week, 7))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      {schedule.isError ? (
        <Alert variant="destructive">
          <p>Não foi possível carregar esta semana.</p>
          <Button
            size="compact-responsive"
            variant="secondary"
            onClick={() => void schedule.refetch()}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : !schedule.data || schedule.isFetching ? (
        <div
          role="status"
          className="grid min-h-48 place-content-center gap-3 rounded-md border border-border"
        >
          <InlineSkeleton className="w-40" />
          <p className="text-caption text-muted-foreground">Carregando a semana…</p>
        </div>
      ) : schedule.data.rows.length ? (
        <WeekGrid
          rows={schedule.data.rows}
          week={schedule.data.week}
          teacherId={id}
          onOpen={onOpen}
        />
      ) : (
        <div className="rounded-md border border-border py-8">
          <EmptyState
            title="Nenhum compromisso nesta semana"
            description="Navegue entre as semanas ou consulte as turmas vinculadas abaixo."
          />
        </div>
      )}
      <p className="text-caption text-muted-foreground">
        Cada divisão representa até 60 minutos. Um encontro de duas horas continua sendo uma única
        aula.
      </p>
    </section>
  );
}
