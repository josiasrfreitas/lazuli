import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, UserRoundPlus } from "lucide-react";
import { Avatar, Badge, Button } from "@lazuli/ui";
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
}: {
  detail: Detail;
  enroll: () => void;
}): ReactElement {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
            Turma · {detail.semester.name}
          </span>
          <Badge variant={detail.scheduleType === "REGULAR" ? "info" : "neutral"}>
            {formatScheduleType(detail.scheduleType)} · {formatFormat(detail.format)}
          </Badge>
          {detail.status === "ARCHIVED" && <Badge>Arquivada</Badge>}
        </div>
        <h1 className="break-words text-3xl font-semibold tracking-tight text-heading">
          {detail.portalClassName}
        </h1>
        <p className="text-sm text-muted-foreground">{classLearningLabel(detail)}</p>
      </div>
      <div className="flex items-center gap-2">
        <ActionHistory classId={detail.id} />
        <Button onClick={enroll}>
          <UserRoundPlus aria-hidden="true" />
          Matricular aluno
        </Button>
      </div>
    </header>
  );
}
function classLearningLabel(detail: Detail): string {
  if (detail.scheduleType === "PERSONALIZED") return "Percursos individuais · curso personalizado";
  if (!detail.sharedStage) return "Estágio não informado";
  return `${formatTrackName(detail.sharedStage.track.name)} · ${detail.sharedStage.name}`;
}
export function ClassContext({
  detail,
  onAssign,
}: {
  detail: Detail;
  onAssign: () => void;
}): ReactElement {
  return (
    <section
      aria-label="Informações da turma"
      className="grid min-w-0 gap-6 rounded-xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-4"
    >
      <TeacherContext detail={detail} onAssign={onAssign} />
      <div className="min-w-0 xl:col-span-2">
        <ClassSchedule slots={detail.scheduleSlots} />
      </div>
      <ClassOccupancy detail={detail} />
    </section>
  );
}
function TeacherContext({
  detail,
  onAssign,
}: {
  detail: Detail;
  onAssign: () => void;
}): ReactElement {
  return (
    <div className="grid content-start gap-3">
      <h2 className="text-caption text-muted-foreground">Professor responsável</h2>
      <div className="flex min-w-0 items-center gap-2">
        {detail.currentTeacher && (
          <Avatar name={detail.currentTeacher.name} colorKey={detail.currentTeacher.id} size="sm" />
        )}
        {detail.currentTeacher ? (
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-interactive hover:underline"
            href={`/professores/${detail.currentTeacher.id}`}
          >
            {detail.currentTeacher.name}
            <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
          </Link>
        ) : (
          <p className="text-sm">Sem professor</p>
        )}
      </div>
      <div>
        <Button variant="ghost" size="sm" onClick={onAssign}>
          Trocar docente
        </Button>
      </div>
      <TeacherAssignments detail={detail} />
    </div>
  );
}
function TeacherAssignments({ detail }: { detail: Detail }): ReactElement | null {
  if (detail.teacherAssignments.length === 0) return null;
  return (
    <details className="text-caption text-muted-foreground">
      <summary className="cursor-pointer rounded-sm py-2 focus-visible:outline-none focus-visible:shadow-focus">
        Histórico docente
      </summary>
      <ol className="mt-2 grid gap-2 border-l border-border pl-3">
        {detail.teacherAssignments.map((assignment) => (
          <li key={assignment.id}>
            {assignment.teacher.name}
            <span className="block">Desde {dateLabel(assignment.effectiveDate)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
function ClassOccupancy({ detail }: { detail: Detail }): ReactElement {
  const indicator = classOccupancyIndicator(detail.occupancy);
  return (
    <div className="grid content-start gap-2 border-t border-border pt-4 md:border-t-0 md:pt-0">
      <h2 className="text-caption text-muted-foreground">Alunos na turma</h2>
      <div className="flex items-baseline gap-2 font-numeric tabular-nums">
        <strong className="text-3xl font-semibold">{detail.occupancy}</strong>
        <span className="text-caption text-muted-foreground">
          / {CLASS_REFERENCE_CAPACITY} de referência
        </span>
      </div>
      {indicator.variant !== "success" && (
        <div>
          <Badge variant={indicator.variant}>{indicator.label}</Badge>
        </div>
      )}
      {detail.scheduledEntries > 0 && (
        <p className="text-caption text-muted-foreground">
          + {detail.scheduledEntries}{" "}
          {detail.scheduledEntries === 1 ? "entrada programada" : "entradas programadas"}
        </p>
      )}
    </div>
  );
}
