"use client";

import type { JSX as ReactJSX } from "react";
import { useId, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, ChevronRight, CircleDashed, Clock3 } from "lucide-react";
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

function presenceState(lesson: Lesson) {
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
    <div id="aulas-da-turma" className={styles.container}>
      <div className={styles.desk} data-show-list={showList}>
        <nav className={styles.rail} aria-label="Aulas da turma">
          <header className={styles.railHeading}>
            <h2>
              Aulas <span>{rows.length}</span>
            </h2>
            <p>Mais recentes primeiro</p>
          </header>
          <ul className={styles.list}>
            {rows.map((lesson) => {
              const { label, icon: Icon, recorded } = presenceState(lesson);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={styles.lesson}
                    aria-pressed={active.id === lesson.id}
                    aria-controls={detailId}
                    onClick={() => {
                      void setSelected(lesson.id);
                      setShowList(false);
                    }}
                  >
                    <span className={styles.lessonDate}>
                      <time dateTime={lesson.date}>{formatDateOnlyBR(lesson.date)}</time>
                      <ChevronRight aria-hidden="true" />
                    </span>
                    <span className={styles.time}>
                      {lesson.startTime}–{lesson.endTime}
                    </span>
                    <span className={styles.contentPreview}>
                      {lesson.content
                        ? `${KIND_LABELS[lesson.content.kind]}${lesson.content.pageFrom === null ? "" : ` · Pág. ${lesson.content.pageFrom}${lesson.content.pageTo && lesson.content.pageTo !== lesson.content.pageFrom ? `–${lesson.content.pageTo}` : ""}`}`
                        : "Conteúdo não registrado"}
                    </span>
                    <span className={styles.status} data-recorded={recorded}>
                      <Icon aria-hidden="true" />
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <section
          id={detailId}
          className={styles.detail}
          aria-label={`Registro da aula de ${formatDateOnlyBR(active.date)}`}
        >
          <div className={styles.mobileBack}>
            <Button variant="ghost" size="sm" onClick={() => setShowList(true)}>
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

function ClassLessonPresence({ lesson }: { lesson: Lesson }): ReactJSX.Element {
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: lesson.id },
    { retry: false, refetchInterval: 30_000 },
  );
  const data = query.data;
  const session = data?.session;
  const recorded = data ? data.version > 0 || data.attendanceOnly : lesson.attendanceRecorded;
  const cancelled = session?.cancelled ?? lesson.state === "CANCELLED";
  const label = cancelled
    ? "Cancelada"
    : recorded
      ? "Presença registrada"
      : "Presença não registrada";
  return (
    <>
      <header className={styles.detailHeading}>
        <div className={styles.detailTitle}>
          <h2>Aula de {formatDateOnlyBR(lesson.date)}</h2>
          <Badge variant={recorded && !cancelled ? "success" : "neutral"}>{label}</Badge>
        </div>
        <p>
          {lesson.startTime}–{lesson.endTime}
          {session &&
            ` · ${session.teacher ?? "Professor a definir"} · ${session.format === "ONLINE" ? "Online" : "Presencial"}`}
        </p>
        {session?.usualTeacher && session.usualTeacher !== session.teacher && (
          <p>Titular: {session.usualTeacher}</p>
        )}
      </header>
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
            {data.session.scheduleType === "REGULAR" && (
              <section className={styles.contentRecord} aria-label="Conteúdo apresentado">
                <h3>Conteúdo apresentado</h3>
                {data.snapshot.sharedContent ? (
                  <>
                    <p className={styles.contentMeta}>
                      {KIND_LABELS[data.snapshot.sharedContent.kind]}
                      {data.snapshot.sharedContent.pageFrom === null
                        ? ""
                        : ` · Pág. ${data.snapshot.sharedContent.pageFrom}${data.snapshot.sharedContent.pageTo && data.snapshot.sharedContent.pageTo !== data.snapshot.sharedContent.pageFrom ? `–${data.snapshot.sharedContent.pageTo}` : ""}`}
                    </p>
                    <p>{data.snapshot.sharedContent.account}</p>
                    {data.snapshot.sharedContent.reference && (
                      <p className={styles.contentMeta}>{data.snapshot.sharedContent.reference}</p>
                    )}
                  </>
                ) : (
                  <p className={styles.contentMeta}>
                    O professor ainda não registrou o conteúdo desta aula.
                  </p>
                )}
              </section>
            )}
            <LessonDetails data={data} />
          </>
        )}
      </div>
    </>
  );
}
