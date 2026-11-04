import type { ReactElement, ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  GraduationCap,
  MapPin,
  Monitor,
  UsersRound,
} from "lucide-react";
import { Badge, DetailHeader } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { CLASS_REFERENCE_CAPACITY } from "@lazuli/domain";
import {
  classOccupancyIndicator,
  formatFormat,
  formatScheduleType,
  formatClassSchedule,
} from "./labels";
import { ClassTeacher } from "./class-teacher";
import { ClassGradeAverage } from "./class-grade-average";
import { ClassStageProgress } from "./class-stage-progress";
import styles from "./class-page.module.css";

type Detail = RouterOutputs["classes"]["byId"];

export function ClassIdentityHeader({
  detail,
  onAssign,
  navigation,
}: {
  detail: Detail;
  onAssign: () => void;
  navigation: ReactNode;
}): ReactElement {
  return (
    <DetailHeader
      size="sm"
      title={detail.sharedStage?.name ?? formatScheduleType(detail.scheduleType)}
      metadata={
        <>
          {detail.status === "ARCHIVED" && <Badge>Arquivada</Badge>}
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-icon" />
            <span className="sr-only">Professor responsável:</span>
            <ClassTeacher detail={detail} onAssign={onAssign} />
          </div>
          <ClassIdentityFacts detail={detail} />
        </>
      }
      actions={navigation}
    />
  );
}

function ClassIdentityFacts({ detail }: { detail: Detail }): ReactElement {
  return (
    <div className={styles.identityFacts}>
      <span title="Modalidade">
        <UsersRound aria-hidden="true" />
        <span className="sr-only">Modalidade: </span>
        {formatScheduleType(detail.scheduleType)}
      </span>
      <span title="Formato">
        {detail.format === "ONLINE" ? (
          <Monitor aria-hidden="true" />
        ) : (
          <MapPin aria-hidden="true" />
        )}
        <span className="sr-only">Formato: </span>
        {formatFormat(detail.format)}
      </span>
      <span title="Semestre">
        <CalendarRange aria-hidden="true" />
        <span className="sr-only">Semestre: </span>
        {detail.semester.name}
      </span>
    </div>
  );
}

export function ClassOverview({ detail }: { detail: Detail }): ReactElement {
  return (
    <section className={styles.overview} aria-label="Visão geral da turma">
      <div className={styles.overviewGrid}>
        <div className={styles.overviewItem}>
          <div className={styles.occupancy}>
            <h2 className="flex items-center gap-2 text-caption text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-4" /> Horários
            </h2>
            <p className={styles.scheduleValue}>
              {formatClassSchedule(detail.scheduleSlots) || "Sem horário cadastrado"}
            </p>
          </div>
        </div>
        <div className={styles.overviewItem}>
          <ClassOccupancy detail={detail} />
        </div>
        <div className={styles.overviewItem}>
          <ClassGradeAverage classId={detail.id} />
        </div>
        <div className={styles.overviewItem}>
          <ClassStageProgress
            classId={detail.id}
            personalized={detail.scheduleType === "PERSONALIZED"}
          />
        </div>
      </div>
    </section>
  );
}

function ClassOccupancy({ detail }: { detail: Detail }): ReactElement {
  const indicator = classOccupancyIndicator(detail.occupancy);
  return (
    <div className={styles.occupancy}>
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <UsersRound aria-hidden="true" className="size-4" />
        Matrículas ativas
      </p>
      <p className={styles.occupancyValue}>
        {detail.occupancy} <span>{detail.occupancy === 1 ? "aluno" : "alunos"}</span>
      </p>
      <p className="text-caption text-muted-foreground">
        Referência: {CLASS_REFERENCE_CAPACITY} alunos
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
