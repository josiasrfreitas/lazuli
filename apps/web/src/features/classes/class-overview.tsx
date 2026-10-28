import type { ReactElement } from "react";
import { GraduationCap, UsersRound } from "lucide-react";
import { Badge } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { CLASS_REFERENCE_CAPACITY } from "@lazuli/domain";
import {
  classOccupancyIndicator,
  formatFormat,
  formatScheduleType,
  formatTrackName,
} from "./labels";
import { ClassTeacher } from "./class-teacher";
import { ClassSchedule } from "./class-schedule";
import { ClassGradeAverage } from "./class-grade-average";
import { ClassStageProgress } from "./class-stage-progress";
import styles from "./class-page.module.css";

type Detail = RouterOutputs["classes"]["byId"];

export function ClassOverview({
  detail,
  onAssign,
}: {
  detail: Detail;
  onAssign: () => void;
}): ReactElement {
  return (
    <header className={styles.overview}>
      <div className={styles.overviewGrid}>
        <ClassIdentity detail={detail} onAssign={onAssign} />
        <div className={styles.schedule}>
          <ClassSchedule slots={detail.scheduleSlots} />
        </div>
        <ClassOccupancy detail={detail} />
        <ClassGradeAverage classId={detail.id} />
        <ClassStageProgress
          classId={detail.id}
          className={detail.portalClassName}
          personalized={detail.scheduleType === "PERSONALIZED"}
        />
      </div>
    </header>
  );
}

function ClassIdentity({
  detail,
  onAssign,
}: {
  detail: Detail;
  onAssign: () => void;
}): ReactElement {
  const sharedStage = detail.scheduleType === "REGULAR" ? detail.sharedStage : null;
  let stageDescription = "Estágio não informado";
  if (sharedStage) stageDescription = formatTrackName(sharedStage.track.name);
  else if (detail.scheduleType === "PERSONALIZED") stageDescription = "Percursos individuais";
  return (
    <div className={styles.identity}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className={styles.title}>{sharedStage?.name ?? detail.portalClassName}</h1>
        {detail.status === "ARCHIVED" && <Badge>Arquivada</Badge>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
        <p className="text-base">{stageDescription}</p>
        <p className="text-caption">
          {formatScheduleType(detail.scheduleType)} · {formatFormat(detail.format)}
        </p>
      </div>
      <ul className={styles.identityDetails} aria-label="Identificação da turma">
        {sharedStage && <li className="font-medium text-foreground">{detail.portalClassName}</li>}
        <li>{detail.semester.name}</li>
      </ul>
      <div className={styles.teacher}>
        {detail.currentTeacher && (
          <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-icon" />
        )}
        <span className="sr-only">Professor responsável:</span>
        <div className="min-w-0">
          <ClassTeacher detail={detail} onAssign={onAssign} />
        </div>
      </div>
    </div>
  );
}

function ClassOccupancy({ detail }: { detail: Detail }): ReactElement {
  const indicator = classOccupancyIndicator(detail.occupancy);
  return (
    <div className={styles.occupancy}>
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <UsersRound aria-hidden="true" className="size-4" />
        Alunos na turma
      </p>
      <p className={styles.occupancyValue}>
        {detail.occupancy} <span>{detail.occupancy === 1 ? "aluno" : "alunos"}</span>
      </p>
      <p className="text-caption text-muted-foreground">
        Referência de {CLASS_REFERENCE_CAPACITY} alunos
      </p>
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
