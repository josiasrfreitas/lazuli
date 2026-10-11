import { TeacherIntroductions } from "./teacher-introductions";
import type { RouterOutputs } from "@lazuli/api";
import type { ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { dateLabel, hoursLabel, mondayOf, shiftDay } from "./format";
import { WeekGrid } from "./week-grid";
import type { Meeting } from "./meeting-dialog";

const DAYS_AFTER_MONDAY = 6;
const MINUTES_PER_HOUR = 60;
const PREVIOUS_WEEK_OFFSET = -7;
const DAYS_PER_WEEK = 7;

export function TeacherWeek({
  id,
  week,
  today,
  studentCount,
  onWeekChange,
  onOpen,
}: TeacherWeekInput): ReactElement {
  const schedule = trpc.teachers.week.useQuery({ id, week });
  return (
    <section className="grid gap-4" aria-label="Semana de aulas">
      <WeekHeading
        week={week}
        scheduleIsError={schedule.isError}
        scheduleData={schedule.data}
        scheduleIsFetching={schedule.isFetching}
        studentCount={studentCount}
        onWeekChange={onWeekChange}
        today={today}
      />
      <WeekSchedule schedule={schedule} id={id} today={today} onOpen={onOpen} />
      {schedule.data && <TeacherIntroductions rows={schedule.data.introductions} />}
      <p className="text-caption text-muted-foreground">
        {schedule.data?.rows.length === 0 && schedule.data.introductions.length === 0
          ? "Nenhum compromisso nesta semana."
          : "Abra uma aula para consultar ou registrar uma substituição."}
      </p>
    </section>
  );
}

type WeekHeadingProps = {
  week: string;
  scheduleIsError: boolean;
  scheduleData: RouterOutputs["teachers"]["week"] | undefined;
  scheduleIsFetching: boolean;
  studentCount: number;
  onWeekChange: (week: string) => void;
  today: string;
};
function WeekHeading(props: WeekHeadingProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <WeekMetrics {...props} />
      <WeekNavigation
        scheduleIsError={props.scheduleIsError}
        scheduleData={props.scheduleData}
        scheduleIsFetching={props.scheduleIsFetching}
        studentCount={props.studentCount}
        onWeekChange={props.onWeekChange}
        week={props.week}
        today={props.today}
      />
    </div>
  );
}

type WeekMetricsProps = WeekHeadingProps;
function WeekMetrics(props: WeekMetricsProps): ReactElement {
  return (
    <div className="grid gap-1">
      <h2 className="text-h3 font-semibold">Semana de aulas</h2>
      <p className="font-numeric text-caption text-muted-foreground">
        {dateLabel(props.week)} a {dateLabel(shiftDay(props.week, DAYS_AFTER_MONDAY))}
      </p>
    </div>
  );
}

type TeacherWeekInput = {
  id: string;
  week: string;
  today: string;
  studentCount: number;
  onWeekChange: (week: string) => void;
  onOpen: (meeting: Meeting) => void;
};

type WeekLoadErrorProps = {
  scheduleRefetch: () => void;
};
function WeekLoadError(props: WeekLoadErrorProps): ReactElement {
  return (
    <Alert variant="destructive">
      <p>Não foi possível carregar esta semana.</p>
      <Button
        size="compact-responsive"
        variant="secondary"
        onClick={() => void props.scheduleRefetch()}
      >
        Tentar novamente
      </Button>
    </Alert>
  );
}

type WeekNavigationProps = {
  scheduleIsError: boolean;
  scheduleData: { rows: Meeting[]; minutes: number; week: string } | undefined;
  scheduleIsFetching: boolean;
  studentCount: number;
  onWeekChange: (week: string) => void;
  week: string;
  today: string;
};
function WeekNavigation(props: WeekNavigationProps): ReactElement {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 sm:w-auto">
      <p className="flex items-baseline gap-1.5 text-caption text-muted-foreground">
        {props.scheduleIsError ? (
          "Carga indisponível"
        ) : (
          <>
            <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
              {props.scheduleData && !props.scheduleIsFetching ? (
                hoursLabel(props.scheduleData.minutes)
              ) : (
                <InlineSkeleton />
              )}
            </span>
            <span>
              {props.scheduleData?.minutes === MINUTES_PER_HOUR ? "hora-aula" : "horas-aula"}
            </span>
          </>
        )}
      </p>
      <p
        className="flex items-baseline gap-1.5 text-caption text-muted-foreground"
        title="Alunos com matrícula vigente nas turmas atuais deste professor, sem duplicação."
      >
        <span className="font-numeric text-h2 font-semibold text-foreground tabular-nums">
          {props.studentCount}
        </span>
        <span>{props.studentCount === 1 ? "aluno" : "alunos"}</span>
      </p>
      <WeekNavigationControls
        propsOnWeekChange={props.onWeekChange}
        propsWeek={props.week}
        propsToday={props.today}
      />
    </div>
  );
}

type WeekNavigationControlsProps = {
  propsOnWeekChange: (week: string) => void;
  propsWeek: string;
  propsToday: string;
};
function WeekNavigationControls(props: WeekNavigationControlsProps): ReactElement {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="icon-compact-responsive"
        aria-label="Semana anterior"
        onClick={() => props.propsOnWeekChange(shiftDay(props.propsWeek, PREVIOUS_WEEK_OFFSET))}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="secondary"
        size="compact-responsive"
        onClick={() => props.propsOnWeekChange(mondayOf(props.propsToday))}
      >
        Hoje
      </Button>
      <Button
        variant="secondary"
        size="icon-compact-responsive"
        aria-label="Próxima semana"
        onClick={() => props.propsOnWeekChange(shiftDay(props.propsWeek, DAYS_PER_WEEK))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

type WeekScheduleProps = Pick<TeacherWeekInput, "id" | "today" | "onOpen"> & {
  schedule: QueryResult<RouterOutputs["teachers"]["week"]>;
};
function WeekSchedule({ schedule, id, today, onOpen }: WeekScheduleProps): ReactElement {
  if (schedule.isError) return <WeekLoadError scheduleRefetch={() => void schedule.refetch()} />;
  if (!schedule.data || schedule.isFetching) {
    return (
      <div
        role="status"
        className="grid min-h-48 place-content-center gap-3 rounded-md border border-border"
      >
        <InlineSkeleton className="w-40" />
        <p className="text-caption text-muted-foreground">Carregando a semana…</p>
      </div>
    );
  }
  return (
    <WeekGrid
      rows={schedule.data.rows}
      week={schedule.data.week}
      teacherId={id}
      today={today}
      onOpen={onOpen}
    />
  );
}
