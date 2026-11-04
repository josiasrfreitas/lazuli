"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  NotebookPen,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { KIND_LABELS } from "~/features/stage-planning/shared";
import { LessonDetails } from "~/features/class-records/lesson-details";
import { RecordState } from "~/features/class-records/shared";
import { lessonParticipants } from "~/features/class-records/record-participants";
import styles from "./class-lessons.module.css";
import panelStyles from "./class-panel.module.css";
import { ClassLessonsLoading, LessonPresenceLoading } from "./class-lessons-loading";

type Lesson = RouterOutputs["classRecords"]["progress"]["rows"][number];
type LessonDetail = RouterOutputs["classRecords"]["detail"];
type LessonQuery = {
  data: LessonDetail | undefined;
  isPending: boolean;
  error: { message: string } | null;
  refetch: () => void;
};
type PresenceState = { label: string; icon: LucideIcon; recorded: boolean };
const lessonDateLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

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
  const deepLinkScrolled = useRef(false);
  const detailId = useId();
  const rows = query.data?.rows ?? [];
  const active = rows.find((row) => row.id === selected) ?? rows[0];
  useEffect(() => {
    if (!query.isSuccess || !selected || active?.id !== selected || deepLinkScrolled.current)
      return;
    deepLinkScrolled.current = true;
    document.querySelector("#aulas-da-turma")?.scrollIntoView({ block: "start" });
  }, [query.isSuccess, selected, active?.id]);
  if (query.isPending) return <ClassLessonsLoading />;
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
  const query = useLessonDetail(active.id);
  return (
    <div id="aulas-da-turma" className={styles.container}>
      <div className={`dark ${panelStyles.surface} ${styles.desk}`} data-show-list={showList}>
        <LessonRail
          rows={rows}
          activeId={active.id}
          detailId={detailId}
          onSelect={onSelect}
          activeData={query.data}
        />
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
          <ClassLessonPresence
            key={active.id}
            query={query}
            pendingEmpty={!active.content && !active.attendanceRecorded}
          />
        </section>
      </div>
    </div>
  );
}

function LessonRail({
  activeData,
  rows,
  activeId,
  detailId,
  onSelect,
}: {
  activeData: LessonDetail | undefined;
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
            data={activeId === lesson.id ? activeData : undefined}
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
  data,
  active,
  detailId,
  onSelect,
}: {
  lesson: Lesson;
  data: LessonDetail | undefined;
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
          <time dateTime={lesson.date}>{lessonDateLabel.format(new Date(lesson.date))}</time>
          <ChevronRight aria-hidden="true" />
        </span>
        <span className={styles.time}>
          {lesson.startTime}–{lesson.endTime}
        </span>
        {data && <span className={styles.time}>{sessionDescription(data.session)}</span>}
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

function useLessonDetail(sessionId: string): LessonQuery {
  return trpc.classRecords.detail.useQuery(
    { sessionId },
    { retry: false, refetchInterval: 30_000 },
  );
}

function ClassLessonPresence({
  query,
  pendingEmpty,
}: {
  query: ReturnType<typeof useLessonDetail>;
  pendingEmpty: boolean;
}): ReactJSX.Element {
  const data = query.data;
  const unrecorded = data && isUnrecordedLesson(data);
  return (
    <div
      className={styles.detailBody}
      data-empty={unrecorded || (query.isPending && pendingEmpty) || undefined}
      aria-busy={query.isPending}
      tabIndex={0}
      role="region"
      aria-label="Alunos e presença"
    >
      {query.isPending ? (
        <LessonPresenceLoading empty={pendingEmpty} />
      ) : (
        <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
      )}
      {data &&
        (unrecorded ? (
          <MissingLessonRecord />
        ) : (
          <LessonDetails
            data={data}
            compactHeading
            content={data.session.scheduleType === "REGULAR" && <LessonContentRecord data={data} />}
          />
        ))}
    </div>
  );
}

function isUnrecordedLesson(data: LessonDetail): boolean {
  return (
    !data.session.cancelled &&
    data.version === 0 &&
    !data.attendanceOnly &&
    !data.snapshot.sharedContent &&
    !data.snapshot.note &&
    !data.snapshot.entries.some((entry) => entry.content) &&
    !lessonParticipants(data).some(
      (person) => person.status === "present" || person.status === "absent",
    )
  );
}

function MissingLessonRecord(): ReactJSX.Element {
  return (
    <div className={styles.unrecorded} role="status">
      <NotebookPen aria-hidden="true" />
      <h2>Aula sem registro</h2>
      <p>O conteúdo e a presença ainda não foram registrados.</p>
    </div>
  );
}

function sessionDescription(session: LessonDetail["session"]): string {
  const teacher = session.teacher ?? "Professor a definir";
  const format = session.format === "ONLINE" ? "Online" : "Presencial";
  const usualTeacher =
    session.usualTeacher && session.usualTeacher !== session.teacher
      ? ` · Titular: ${session.usualTeacher}`
      : "";
  return `${teacher} · ${format}${usualTeacher}`;
}

function LessonContentRecord({ data }: { data: LessonDetail }): ReactJSX.Element {
  const content = data.snapshot.sharedContent;
  if (!content) return <MissingLessonContent />;
  return (
    <section className={styles.contentRecord} aria-label="Conteúdo apresentado">
      <header className={styles.contentHeading}>
        <h3>Conteúdo apresentado</h3>
        <p className={styles.contentMeta}>
          {KIND_LABELS[content.kind]}
          {content.pageFrom === null
            ? ""
            : ` · Pág. ${content.pageFrom}${content.pageTo && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : ""}`}
        </p>
      </header>
      <p>{content.account}</p>
      {content.reference && (
        <p className={styles.contentReference}>
          <Paperclip aria-hidden="true" />
          {content.reference}
        </p>
      )}
    </section>
  );
}

function MissingLessonContent(): ReactJSX.Element {
  return (
    <section className={styles.contentEmpty} aria-label="Conteúdo não registrado">
      <NotebookPen aria-hidden="true" />
      <div>
        <h3>Conteúdo não registrado</h3>
        <p>Por enquanto, o diário desta aula está em branco.</p>
      </div>
    </section>
  );
}
