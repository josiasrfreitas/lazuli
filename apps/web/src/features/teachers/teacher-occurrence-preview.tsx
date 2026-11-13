"use client";
import { StudentAvatar } from "~/components/student-avatar";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Pause,
  Play,
} from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { useOccurrenceRotation } from "~/features/classes/use-occurrence-rotation";
import { CATEGORY, OCCURRENCE_STATUS, dateLabel } from "~/features/pedagogical-follow-up/shared";
import { studentFollowUpHref } from "~/features/pedagogical-follow-up/student-navigation";
import styles from "./teacher-overview.module.css";
import { TeacherOccurrenceLoading } from "./teacher-metric-loading";

type Occurrence = RouterOutputs["teachers"]["metrics"]["occurrences"][number];
type Rotation = ReturnType<typeof useOccurrenceRotation>;
type Metrics = RouterOutputs["teachers"]["metrics"];
export function TeacherOccurrencePreview({
  data,
  pending,
  onDetails,
}: {
  data: Metrics | undefined;
  pending: boolean;
  onDetails: (button: HTMLButtonElement) => void;
}): ReactElement {
  const rows = data?.occurrences ?? [];
  const rotation = useOccurrenceRotation(rows.length);
  const row = rows[rotation.index];
  const open = rows.filter((item) => item.status !== "CLOSED");
  return (
    <section
      className={`${styles.metricCard} ${styles.occurrenceCard}`}
      aria-label="Acompanhamento"
      data-attention={open.length > 0 || undefined}
      onMouseEnter={() => rotation.setHovered(true)}
      onMouseLeave={() => rotation.setHovered(false)}
      onFocusCapture={() => rotation.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) rotation.setFocused(false);
      }}
    >
      <div className={styles.cardHeading}>
        <h2>
          <MessageSquareText aria-hidden="true" />
          Acompanhamento
        </h2>
        <Button
          size="sm"
          variant="link"
          disabled={rows.length === 0}
          onClick={(event) => onDetails(event.currentTarget)}
        >
          Ver todas
        </Button>
      </div>
      <OccurrencePreviewBody
        data={data}
        pending={pending}
        row={row}
        open={open}
        rows={rows}
        rotation={rotation}
      />
    </section>
  );
}

function OccurrencePreviewBody({
  data,
  pending,
  row,
  open,
  rows,
  rotation,
}: {
  data: Metrics | undefined;
  pending: boolean;
  row: Occurrence | undefined;
  open: Occurrence[];
  rows: Occurrence[];
  rotation: Rotation;
}): ReactElement {
  if (pending) return <TeacherOccurrenceLoading />;
  if (!row) return <OccurrenceEmpty data={data} />;
  return (
    <>
      <p className={styles.occurrenceTotals}>
        <strong data-attention={open.length > 0 || undefined}>{open.length} em aberto</strong>
        <span>·</span>
        {open.filter((item) => item.accompanied).length} com intervenção
      </p>
      <OccurrenceSlide key={row.id} row={row} automatic={rotation.automatic} />
      <OccurrenceFooter row={row} count={rows.length} rotation={rotation} />
    </>
  );
}
function OccurrenceEmpty({ data }: { data: Metrics | undefined }): ReactElement {
  return (
    <div className={styles.occurrenceEmpty}>
      <MessageSquareText aria-hidden="true" />
      <h3>{data ? "Tudo tranquilo por aqui" : "Ocorrências indisponíveis"}</h3>
      <p>
        {data
          ? "Por enquanto, só o verbo to be dando trabalho. Nenhuma ocorrência registrada."
          : "Tente atualizar os indicadores."}
      </p>
    </div>
  );
}

function OccurrenceSlide({
  row,
  automatic,
}: {
  row: Occurrence;
  automatic: boolean;
}): ReactElement {
  return (
    <div className={styles.occurrenceSlide} aria-live={automatic ? "off" : "polite"}>
      <div className={styles.occurrenceStudent}>
        <StudentAvatar name={row.name} colorKey={row.studentId} size="md" />
        <div>
          <Link href={`/alunos/${row.studentId}?secao=pedagogico`}>{row.name}</Link>
          <span>
            {row.outsideClass ? "Fora de aula" : "Em aula"}
            {row.date ? ` · ${dateLabel(row.date)}` : ""}
          </span>
        </div>
        <Badge variant={occurrenceTone(row.status)}>{OCCURRENCE_STATUS[row.status]}</Badge>
      </div>
      <div className={styles.occurrenceReport}>
        <p className={styles.occurrenceCategory}>{CATEGORY[row.category]}</p>
        <div className={styles.occurrenceColumns} data-response={Boolean(row.initialResponse)}>
          <div>
            <h3>{row.title}</h3>
            <p
              className={styles.occurrenceExcerpt}
              tabIndex={0}
              role="region"
              aria-label="Relato da ocorrência"
            >
              {row.summary}
            </p>
          </div>
          {row.initialResponse && (
            <div className={styles.occurrenceResponse}>
              <h3>Ação imediata</h3>
              <p
                className={styles.occurrenceExcerpt}
                tabIndex={0}
                role="region"
                aria-label="Ação imediata"
              >
                {row.initialResponse}
              </p>
            </div>
          )}
        </div>
        <p className={styles.occurrenceAuthor}>Registrado por {row.recordedBy}</p>
      </div>
    </div>
  );
}

function OccurrenceFooter({
  row,
  count,
  rotation,
}: {
  row: Occurrence;
  count: number;
  rotation: Rotation;
}): ReactElement {
  return (
    <footer className={styles.occurrenceFooter}>
      <Link href={studentFollowUpHref(row.studentId, { kind: "occurrence", id: row.id })}>
        Ver relato
        <ArrowUpRight aria-hidden="true" />
      </Link>
      {count > 1 && (
        <div className={styles.occurrenceControls}>
          <span>
            {rotation.index + 1} de {count}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ocorrência anterior"
            onClick={rotation.previous}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima ocorrência"
            onClick={rotation.next}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={rotation.paused ? "Retomar troca automática" : "Pausar troca automática"}
            onClick={rotation.togglePaused}
          >
            {rotation.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </Button>
        </div>
      )}
    </footer>
  );
}

function occurrenceTone(status: Occurrence["status"]): "success" | "info" | "warning" {
  if (status === "CLOSED") return "success";
  return status === "FOLLOWING_UP" ? "info" : "warning";
}
