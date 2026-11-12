"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { Avatar, Button, InlineSkeleton, Switch } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { CATEGORY, OCCURRENCE_STATUS, dateLabel } from "~/features/pedagogical-follow-up/shared";
import { studentFollowUpHref } from "~/features/pedagogical-follow-up/student-navigation";
import { useOccurrenceRotation } from "./use-occurrence-rotation";
import styles from "./class-occurrences.module.css";

type Occurrence = RouterOutputs["occurrences"]["recentForClass"][number];

export function ClassRecentOccurrences({ classId }: { classId: string }): ReactElement {
  const query = trpc.occurrences.recentForClass.useQuery({ classId });
  const rows = query.data ?? [];
  let content: ReactElement;
  if (query.isPending) {
    content = (
      <div role="status" className={styles.state}>
        <span className="sr-only">Carregando ocorrências</span>
        <InlineSkeleton className="h-8 w-40" />
        <InlineSkeleton className="h-20 w-full" />
      </div>
    );
  } else if (query.isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>Não foi possível carregar as ocorrências.</p>
        <Button variant="link" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  } else if (rows.length > 0) {
    content = <OccurrenceCarousel rows={rows} />;
  } else {
    content = (
      <div className={`${styles.state} ${styles.empty}`} role="status">
        <MessageSquareText aria-hidden="true" />
        <h3>Tudo tranquilo por aqui</h3>
        <p>
          Nenhuma ocorrência registrada. Por enquanto, só o verbo <em>to be</em> dando trabalho.
        </p>
      </div>
    );
  }
  return (
    <section className={styles.section} aria-labelledby="class-occurrences-title">
      <header className={styles.sectionHeading}>
        <h2 id="class-occurrences-title">
          Ocorrências <span>{rows.length > 0 ? rows.length : ""}</span>
        </h2>
      </header>
      <div className={`dark ${styles.panel}`}>{content}</div>
    </section>
  );
}

function OccurrenceCarousel({ rows }: { rows: Occurrence[] }): ReactElement {
  const rotation = useOccurrenceRotation(rows.length);
  const row = rows[rotation.index]!;
  const multiple = rows.length > 1;
  return (
    <div
      className={styles.carousel}
      role="group"
      aria-roledescription="carrossel"
      aria-label="Relatos das aulas"
      onMouseEnter={() => rotation.setHovered(true)}
      onMouseLeave={() => rotation.setHovered(false)}
      onFocusCapture={() => rotation.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) rotation.setFocused(false);
      }}
    >
      <header className={styles.header}>
        <OccurrenceStudent row={row} />
        {multiple && <OccurrenceControls rotation={rotation} total={rows.length} />}
      </header>
      <div className={styles.slideRegion} aria-live={rotation.automatic ? "off" : "polite"}>
        <OccurrenceSlide key={row.id} row={row} index={rotation.index} total={rows.length} />
      </div>
      <OccurrenceFooter row={row} rotation={multiple ? rotation : undefined} />
    </div>
  );
}

function OccurrenceFooter({
  row,
  rotation,
}: {
  row: Occurrence;
  rotation: ReturnType<typeof useOccurrenceRotation> | undefined;
}): ReactElement {
  return (
    <footer className={styles.footer}>
      <Link
        className={styles.detailLink}
        href={studentFollowUpHref(row.student.id, { kind: "occurrence", id: row.id })}
      >
        Abrir acompanhamento <ArrowUpRight aria-hidden="true" />
      </Link>
      {rotation && (
        <label
          className={styles.automatic}
          title="Trocar a ocorrência após 20 segundos sem interação"
        >
          <Switch
            checked={!rotation.paused}
            onCheckedChange={rotation.togglePaused}
            aria-label="Troca automática de ocorrências"
          />
          <span className={styles.automaticLabel} aria-hidden="true">
            Exibição automática
          </span>
        </label>
      )}
    </footer>
  );
}

function OccurrenceStudent({ row }: { row: Occurrence }): ReactElement {
  return (
    <div className={styles.student}>
      <Avatar name={row.student.fullName} colorKey={row.student.id} size="md" />
      <div>
        <Link href={`/alunos/${row.student.id}`}>{row.student.fullName}</Link>
        <span>Aula de {dateLabel(row.classSession?.date ?? row.occurredOn ?? row.createdAt)}</span>
      </div>
    </div>
  );
}

function OccurrenceSlide({
  row,
  index,
  total,
}: {
  row: Occurrence;
  index: number;
  total: number;
}): ReactElement {
  return (
    <div
      className={styles.slide}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} de ${total}`}
    >
      <OccurrenceReport row={row} />
    </div>
  );
}

function OccurrenceReport({ row }: { row: Occurrence }): ReactElement {
  return (
    <div className={styles.report} data-response={!!row.initialResponse}>
      <p className={styles.category}>
        {CATEGORY[row.category]} <span>· {OCCURRENCE_STATUS[row.status]}</span>
      </p>
      <div className={styles.reportColumns} data-response={!!row.initialResponse}>
        <div className={styles.reportColumn}>
          <h3>{row.title}</h3>
          <div
            className={styles.reportText}
            tabIndex={0}
            role="region"
            aria-label="Relato da ocorrência"
          >
            <p className={styles.account}>{row.account}</p>
          </div>
        </div>
        {row.initialResponse && (
          <div className={`${styles.reportColumn} ${styles.response}`}>
            <h3>Ação imediata</h3>
            <div
              className={styles.reportText}
              tabIndex={0}
              role="region"
              aria-label="Ação imediata"
            >
              <p className={styles.account}>{row.initialResponse}</p>
            </div>
          </div>
        )}
      </div>
      <p className={styles.author}>Registrado por {row.recordedBy.name}</p>
    </div>
  );
}

function OccurrenceControls({
  rotation,
  total,
}: {
  rotation: ReturnType<typeof useOccurrenceRotation>;
  total: number;
}): ReactElement {
  return (
    <div className={styles.controls}>
      <span className={styles.counter}>
        {rotation.index + 1} de {total}
      </span>
      <Button
        variant="ghost"
        size="icon-compact-responsive"
        onClick={rotation.previous}
        aria-label="Ocorrência anterior"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-compact-responsive"
        onClick={rotation.next}
        aria-label="Próxima ocorrência"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
