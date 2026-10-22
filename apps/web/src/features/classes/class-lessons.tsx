"use client";

import type { JSX as ReactJSX } from "react";
import { useId, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Badge, Button, PencilLoader } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { KIND_LABELS } from "~/features/stage-planning/shared";
import { LessonDetails } from "~/features/class-records/lesson-details";
import { RecordState } from "~/features/class-records/shared";
import styles from "./class-lessons.module.css";

type Lesson = RouterOutputs["classRecords"]["progress"]["rows"][number];
type LessonDetail = RouterOutputs["classRecords"]["detail"];
type PresenceState = { label: string; icon: LucideIcon; recorded: boolean };

function presenceState(lesson: Lesson): PresenceState {
  if (lesson.state === "CANCELLED") return { label: "Cancelada", icon: Ban, recorded: false };
  if (lesson.attendanceRecorded)
    return { label: "Presença registrada", icon: CheckCircle2, recorded: true };
  if (lesson.state === "UPCOMING") return { label: "Agendada", icon: Clock3, recorded: false };
  return { label: "Sem registro de presença", icon: CircleDashed, recorded: false };
}

export function ClassLessons({ classId }: { classId: string }): ReactJSX.Element {
  const query = trpc.classRecords.progress.useQuery({ classId }, { retry: false });
  const [selected, setSelected] = useQueryState("aula", parseAsString.withDefault(""));
  const [showList, setShowList] = useState(false);
  const detailId = useId();
  const rows = query.data?.rows ?? [];
  const active = rows.find((row) => row.id === selected) ?? rows[0];
  if (query.isPending)
    return (
      <div className={styles.loading}>
        <PencilLoader size="sm" label="Carregando aulas da turma" />
      </div>
    );
  if (query.isError)
    return <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />;
  if (!active)
    return (
      <div className={styles.empty}>
        <h2>Nenhuma aula para consultar</h2>
        <p>As aulas aparecem aqui conforme o calendário da turma avança.</p>
      </div>
    );
  return (
    <ClassLessonsView
      rows={rows}
      active={active}
      detailId={detailId}
      showList={showList}
      onSelect={(id) => {
        void setSelected(id);
        setShowList(false);
      }}
      onShowList={() => setShowList(true)}
    />
  );
}

function ClassLessonsView({
  rows,
  active,
  detailId,
  showList,
  onSelect,
  onShowList,
}: {
  rows: Lesson[];
  active: Lesson;
  detailId: string;
  showList: boolean;
  onSelect: (id: string) => void;
  onShowList: () => void;
}): ReactJSX.Element {
  return (
    <div id="aulas-da-turma" className={styles.container}>
      <div className={styles.desk} data-show-list={showList}>
        <LessonRail rows={rows} activeId={active.id} detailId={detailId} onSelect={onSelect} />
        <section
          id={detailId}
          className={styles.detail}
          aria-label={`Registro da aula de ${formatDateOnlyBR(active.date)}`}
        >
          <div className={styles.mobileBack}>
            <Button variant="ghost" size="sm" onClick={onShowList}>
              <ArrowLeft aria-hidden="true" />
              Todas as aulas
            </Button>
          </div>
          <ClassLessonPresence key={active.id} lesson={active} />
        </section>
      </div>
    </div>
  );
}

function LessonRail({
  rows,
  activeId,
  detailId,
  onSelect,
}: {
  rows: Lesson[];
  activeId: string;
  detailId: string;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <nav className={styles.rail} aria-label="Aulas da turma">
      <header className={styles.railHeading}>
        <h2>
          Aulas <span>{rows.length}</span>
        </h2>
        <p>Mais recentes primeiro</p>
      </header>
      <ul className={styles.list}>
        {rows.map((lesson) => (
          <LessonRailItem
            key={lesson.id}
            lesson={lesson}
            active={activeId === lesson.id}
            detailId={detailId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}

function LessonRailItem({
  lesson,
  active,
  detailId,
  onSelect,
}: {
  lesson: Lesson;
  active: boolean;
  detailId: string;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const { label, icon: Icon, recorded } = presenceState(lesson);
  return (
    <li>
      <button
        type="button"
        className={styles.lesson}
        aria-pressed={active}
        aria-controls={detailId}
        onClick={() => onSelect(lesson.id)}
      >
        <span className={styles.lessonDate}>
          <time dateTime={lesson.date}>{formatDateOnlyBR(lesson.date)}</time>
          <ChevronRight aria-hidden="true" />
        </span>
        <span className={styles.time}>
          {lesson.startTime}–{lesson.endTime}
        </span>
        <span className={styles.contentPreview}>{lessonPreview(lesson)}</span>
        <span className={styles.status} data-recorded={recorded}>
          <Icon aria-hidden="true" />
          {label}
        </span>
      </button>
    </li>
  );
}

function lessonPreview(lesson: Lesson): string {
  const content = lesson.content;
  if (!content) return "Conteúdo não registrado";
  if (content.pageFrom === null) return KIND_LABELS[content.kind];
  const pageTo = content.pageTo && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : "";
  return `${KIND_LABELS[content.kind]} · Pág. ${content.pageFrom}${pageTo}`;
}

function ClassLessonPresence({ lesson }: { lesson: Lesson }): ReactJSX.Element {
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: lesson.id },
    { retry: false, refetchInterval: 30_000 },
  );
  const data = query.data;
  return (
    <>
      <LessonPresenceHeading lesson={lesson} data={data} />
      <div
        className={styles.detailBody}
        aria-busy={query.isPending}
        tabIndex={0}
        role="region"
        aria-label="Alunos e presença"
      >
        {query.isPending ? (
          <div className={styles.loading}>
            <PencilLoader size="sm" label="Carregando presença" />
          </div>
        ) : (
          <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
        )}
        {data && (
          <>
            {data.session.scheduleType === "REGULAR" && <LessonContentRecord data={data} />}
            <LessonDetails data={data} />
          </>
        )}
      </div>
    </>
  );
}

function LessonPresenceHeading({
  lesson,
  data,
}: {
  lesson: Lesson;
  data: LessonDetail | undefined;
}): ReactJSX.Element {
  const session = data?.session;
  const { recorded, cancelled, label } = lessonPresenceStatus(data, lesson);
  return (
    <header className={styles.detailHeading}>
      <div className={styles.detailTitle}>
        <h2>Aula de {formatDateOnlyBR(lesson.date)}</h2>
        <Badge variant={recorded && !cancelled ? "success" : "neutral"}>{label}</Badge>
      </div>
      <p>
        {lesson.startTime}–{lesson.endTime}
        {session && sessionDescription(session)}
      </p>
      {session?.usualTeacher && session.usualTeacher !== session.teacher && (
        <p>Titular: {session.usualTeacher}</p>
      )}
    </header>
  );
}

function lessonPresenceStatus(
  data: LessonDetail | undefined,
  lesson: Lesson,
): {
  recorded: boolean;
  cancelled: boolean;
  label: string;
} {
  const recorded = data ? data.version > 0 || data.attendanceOnly : lesson.attendanceRecorded;
  const cancelled = data?.session.cancelled ?? lesson.state === "CANCELLED";
  let label = "Presença não registrada";
  if (cancelled) label = "Cancelada";
  else if (recorded) label = "Presença registrada";
  return { recorded, cancelled, label };
}

function sessionDescription(session: LessonDetail["session"]): string {
  const teacher = session.teacher ?? "Professor a definir";
  const format = session.format === "ONLINE" ? "Online" : "Presencial";
  return ` · ${teacher} · ${format}`;
}

function LessonContentRecord({ data }: { data: LessonDetail }): ReactJSX.Element {
  const content = data.snapshot.sharedContent;
  return (
    <section className={styles.contentRecord} aria-label="Conteúdo apresentado">
      <h3>Conteúdo apresentado</h3>
      {content ? (
        <>
          <p className={styles.contentMeta}>
            {KIND_LABELS[content.kind]}
            {content.pageFrom === null
              ? ""
              : ` · Pág. ${content.pageFrom}${content.pageTo && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : ""}`}
          </p>
          <p>{content.account}</p>
          {content.reference && <p className={styles.contentMeta}>{content.reference}</p>}
        </>
      ) : (
        <p className={styles.contentMeta}>O professor ainda não registrou o conteúdo desta aula.</p>
      )}
    </section>
  );
}
