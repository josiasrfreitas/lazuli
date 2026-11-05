import type { ReactElement } from "react";
import {
  ToastAlert,
  Button,
  InlineSkeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { hoursLabel } from "./format";
import { WeekGrid } from "./week-grid";

const HOUR_LESSON_MINUTES = 60;

export function TeacherWeek({
  id,
  back,
  studentCount,
}: {
  id: string;
  back: string;
  studentCount: number | undefined;
}): ReactElement {
  const schedule = trpc.teachers.agenda.useQuery({ id });
  return (
    <section className="grid gap-4" aria-label="Agenda do professor">
      <WeekHeader
        minutes={schedule.data?.minutes}
        isError={schedule.isError}
        studentCount={studentCount}
      />
      {schedule.isError ? (
        <ToastAlert variant="destructive">
          <p>Não foi possível carregar a agenda.</p>
          <Button
            size="compact-responsive"
            variant="secondary"
            onClick={() => void schedule.refetch()}
          >
            Tentar novamente
          </Button>
        </ToastAlert>
      ) : (
        <WeekGrid rows={schedule.data?.rows ?? []} back={back} loading={!schedule.data} />
      )}
      {schedule.data && (
        <p className="text-caption text-muted-foreground">
          {schedule.data.rows.length === 0
            ? "Nenhum horário recorrente nas turmas vigentes."
            : "Clique em um horário para abrir a turma."}
        </p>
      )}
    </section>
  );
}

function WeekHeader({
  minutes,
  isError,
  studentCount,
}: {
  minutes: number | undefined;
  isError: boolean;
  studentCount: number | undefined;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-h3 font-semibold">Agenda do professor</h2>
        <p className="text-caption text-muted-foreground">
          Horários recorrentes das turmas vigentes
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {isError ? (
          <p className="text-caption text-muted-foreground">Carga indisponível</p>
        ) : (
          <WeekHours minutes={minutes} />
        )}
        <p
          className="flex items-baseline gap-1.5 text-caption text-muted-foreground"
          title="Alunos com matrícula vigente nas turmas atuais deste professor, sem duplicação."
        >
          <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
            {studentCount ?? <InlineSkeleton className="h-6 w-8" />}
          </span>
          <span>{studentCount === 1 ? "aluno" : "alunos"}</span>
        </p>
      </div>
    </div>
  );
}

function WeekHours({ minutes }: { minutes: number | undefined }): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        className="flex items-baseline gap-1.5 text-caption text-muted-foreground"
      >
        <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
          {minutes === undefined ? <InlineSkeleton /> : hoursLabel(minutes)}
        </span>
        <span>{minutes === HOUR_LESSON_MINUTES ? "hora-aula" : "horas-aula"}</span>
      </TooltipTrigger>
      <TooltipContent>1 hora-aula = 60 minutos.</TooltipContent>
    </Tooltip>
  );
}
