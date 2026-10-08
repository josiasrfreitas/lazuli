import { ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, hoursLabel, mondayOf, shiftDay } from "./format";
import { WeekGrid } from "./week-grid";
import type { Meeting } from "./meeting-dialog";
export function TeacherWeek({
  id,
  week,
  today,
  studentCount,
  onWeekChange,
  onOpen,
}: {
  id: string;
  week: string;
  today: string;
  studentCount: number;
  onWeekChange: (week: string) => void;
  onOpen: (meeting: Meeting) => void;
}) {
  const schedule = trpc.teachers.week.useQuery({ id, week });
  return (
    <section className="grid gap-4" aria-label="Semana de aulas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-h3 font-semibold">Semana de aulas</h2>
          <p className="font-numeric text-caption text-muted-foreground">
            {dateLabel(week)} a {dateLabel(shiftDay(week, 6))}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 sm:w-auto">
          <p className="flex items-baseline gap-1.5 text-caption text-muted-foreground">
            {schedule.isError ? "Carga indisponível" : (
              <>
                <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
                  {schedule.data && !schedule.isFetching ? hoursLabel(schedule.data.minutes) : <InlineSkeleton />}
                </span>
                <span>{schedule.data?.minutes === 60 ? "hora-aula" : "horas-aula"}</span>
              </>
            )}
          </p>
          <p
            className="flex items-baseline gap-1.5 text-caption text-muted-foreground"
            title="Alunos com matrícula vigente nas turmas atuais deste professor, sem duplicação."
          >
            <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
              {studentCount}
            </span>
            <span>{studentCount === 1 ? "aluno" : "alunos"}</span>
          </p>
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
      ) : (
        <WeekGrid
          rows={schedule.data.rows}
          week={schedule.data.week}
          teacherId={id}
          today={today}
          onOpen={onOpen}
        />
      )}
      <p className="text-caption text-muted-foreground">
        {schedule.data?.rows.length === 0
          ? "Nenhum compromisso nesta semana."
          : "Abra uma aula para consultar ou registrar uma substituição."}
      </p>
    </section>
  );
}
