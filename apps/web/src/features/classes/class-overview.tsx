import type { ReactElement } from "react";
import { UserRoundPlus } from "lucide-react";
import { Avatar, Badge, Button, Input } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { CLASS_REFERENCE_CAPACITY } from "@lazuli/domain";
import {
  classOccupancyIndicator,
  formatFormat,
  formatScheduleType,
  formatTrackName,
} from "./labels";
import { dateLabel } from "../teachers/format";
import { ClassSchedule } from "./class-schedule";
import { ActionHistory } from "./action-history";

type Detail = RouterOutputs["classes"]["byId"];

export function ClassOverview({
  detail,
  enroll,
  search,
  onSearchChange,
}: ClassOverviewInput): ReactElement {
  return (
    <header className="min-w-0 shrink-0 space-y-2">
      <h1 className="min-w-0 max-w-full break-words font-display text-h1 font-medium text-heading">
        {detail.portalClassName}
      </h1>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span>{detail.semester.name}</span>
          <Badge variant={detail.scheduleType === "REGULAR" ? "info" : "neutral"}>
            {formatScheduleType(detail.scheduleType)}
          </Badge>
          <span>{formatFormat(detail.format)}</span>
          {detail.status === "ARCHIVED" && <Badge>Arquivada</Badge>}
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-40 flex-1 sm:w-48 sm:flex-none">
            <Input
              aria-label="Buscar aluno na turma"
              size="sm"
              placeholder="Buscar aluno"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <ActionHistory classId={detail.id} />
          <Button size="sm" onClick={enroll}>
            <UserRoundPlus aria-hidden="true" />
            Matricular aluno
          </Button>
        </div>
      </div>
    </header>
  );
}

export function ClassContextSidebar({ detail, onAssign }: ClassContextSidebarInput): ReactElement {
  return (
    <aside
      aria-label="Informações da turma"
      className="min-w-0 self-start rounded-xl bg-card p-5 ring-1 ring-border/60 lg:max-h-full lg:w-72 lg:shrink-0 lg:self-stretch lg:overflow-y-auto"
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-caption text-muted-foreground">Professor</p>
          <div className="flex items-center gap-2">
            {detail.currentTeacher && (
              <Avatar name={detail.currentTeacher.name} colorKey={detail.currentTeacher.id} />
            )}
            <p className="min-w-0 break-words text-body font-medium">
              {detail.currentTeacher?.name ?? "Sem professor"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onAssign}>
            Trocar docente
          </Button>
          {detail.teacherAssignments.map((assignment) => (
            <p key={assignment.id} className="text-caption text-muted-foreground">
              {assignment.teacher.name} · desde {dateLabel(assignment.effectiveDate)}
            </p>
          ))}
        </div>
        {detail.scheduleType === "REGULAR" && <ClassStageSummary detail={detail} />}
        <ClassOccupancy detail={detail} />
        <ClassSchedule slots={detail.scheduleSlots} />
      </div>
    </aside>
  );
}

function ClassOccupancy({ detail }: ClassOccupancyInput): ReactElement {
  const indicator = classOccupancyIndicator(detail.occupancy);
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-caption text-muted-foreground">Alunos na turma</p>
      <div className="flex items-baseline gap-1.5 font-numeric tabular-nums">
        <strong className={occupancyClassName(indicator.variant)}>{detail.occupancy}</strong>
        <span className="text-caption text-muted-foreground">
          / {CLASS_REFERENCE_CAPACITY} alunos
        </span>
      </div>
      {detail.scheduledEntries > 0 && (
        <p className="text-caption text-muted-foreground">
          + {detail.scheduledEntries}{" "}
          {detail.scheduledEntries === 1 ? "entrada programada" : "entradas programadas"}
        </p>
      )}
    </div>
  );
}

type ClassOverviewInput = {
  detail: Detail;
  enroll: () => void;
  search: string;
  onSearchChange: (value: string) => void;
};
type ClassContextSidebarInput = {
  detail: Detail;
  onAssign: () => void;
};
type ClassOccupancyInput = { detail: Detail };

type ClassStageSummaryProps = {
  detail: Detail;
};
function ClassStageSummary(props: ClassStageSummaryProps): ReactElement {
  return (
    <dl className="space-y-3">
      <div>
        <dt className="text-caption text-muted-foreground">Trilha</dt>
        <dd className="mt-1 break-words text-body">
          {props.detail.sharedStage
            ? formatTrackName(props.detail.sharedStage.track.name)
            : "Trilha não informada"}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Estágio</dt>
        <dd className="mt-1 break-words text-body">
          {props.detail.sharedStage?.name ?? "Estágio não informado"}
        </dd>
      </div>
    </dl>
  );
}

function occupancyClassName(variant: string): string {
  if (variant === "over-capacity") return "text-h2 font-semibold text-over-capacity";
  if (variant === "destructive") return "text-h2 font-semibold text-destructive";
  return "text-h2 font-semibold";
}
