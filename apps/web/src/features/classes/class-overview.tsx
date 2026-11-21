import type { ReactElement, ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  GraduationCap,
  MapPin,
  Monitor,
  UsersRound,
  Pencil,
  BookOpen,
} from "lucide-react";
import { Badge, DetailHeader } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
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
            <span className="sr-only">Docente responsável:</span>
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

export function ClassOverview({
  detail,
  editCapacity,
}: {
  detail: Detail;
  editCapacity: () => void;
}): ReactElement {
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
          <ClassBooks detail={detail} />
        </div>
        <div className={styles.overviewItem}>
          <ClassOccupancy detail={detail} editCapacity={editCapacity} />
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

function ClassBooks({ detail }: { detail: Detail }): ReactElement {
  const personalized = detail.scheduleType === "PERSONALIZED";
  const current = detail.books?.current;
  const next = detail.books?.next;
  return (
    <section className={styles.occupancy} aria-label="Livros da turma">
      <h2 className="flex items-center gap-2 text-caption text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-4" /> Livro atual
      </h2>
      <p className={styles.bookValue}>
        {personalized ? "Por aluno" : (current?.name ?? "Não definido")}
      </p>
      {personalized ? (
        <p className="text-caption text-muted-foreground">Livros e avanços individuais</p>
      ) : (
        <NextClassBook next={next} hasCurrent={Boolean(current)} />
      )}
    </section>
  );
}

function NextClassBook({
  next,
  hasCurrent,
}: {
  next: NonNullable<Detail["books"]>["next"] | undefined;
  hasCurrent: boolean;
}): ReactElement {
  if (next)
    return (
      <p className={styles.nextBook} title="Próximo livro pela sequência do curso">
        <span>Próximo</span> <strong>{next.name}</strong>
      </p>
    );
  return (
    <p className="text-caption text-muted-foreground">
      {hasCurrent ? "Fim da trilha" : "Próximo a definir"}
    </p>
  );
}

function ClassOccupancy({
  detail,
  editCapacity,
}: {
  detail: Detail;
  editCapacity: () => void;
}): ReactElement {
  const indicator = classOccupancyIndicator(detail.occupancy, detail.capacity);
  return (
    <div className={styles.occupancy}>
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <UsersRound aria-hidden="true" className="size-4" />
        Matrículas ativas
      </p>
      <p className={styles.occupancyValue}>
        {detail.occupancy} <span>{detail.occupancy === 1 ? "aluno" : "alunos"}</span>
      </p>
      <p className="flex items-center gap-1 text-caption text-muted-foreground">
        <button
          type="button"
          className="inline-flex h-5 w-4 shrink-0 items-center justify-start rounded-sm p-0 text-interactive hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={editCapacity}
          aria-label="Editar capacidade máxima"
        >
          <Pencil aria-hidden="true" className="size-3" />
        </button>
        Capacidade máxima: {detail.capacity} alunos
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
