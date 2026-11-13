import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarCheck } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { formatClassSchedule } from "~/features/classes/labels";
import { metricNumber } from "./teacher-metric-details";
import styles from "./teacher-class-indicators.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];
type MetricClass = Metrics["classes"][number];
const PREVIEW_CLASS_COUNT = 4;
type Props = {
  kind: "learning" | "attendance";
  data: Metrics | undefined;
  pending: boolean;
  onDetails: (button: HTMLButtonElement) => void;
};
export function TeacherClassIndicators({ kind, data, pending, onDetails }: Props): ReactElement {
  const learning = kind === "learning";
  const title = learning ? "Aprendizagem" : "Frequência";
  const rows = data?.classes.slice(0, PREVIEW_CLASS_COUNT) ?? [];
  const value = learning ? data?.grades : data?.attendance.percent;
  return (
    <section className={styles.card} aria-label={title} aria-busy={pending}>
      <IndicatorHeader learning={learning} pending={pending} value={value} />
      <div className={styles.columns}>
        <span>Turma · estágio e horário</span>
        {!learning && <span>Chamadas</span>}
        <span>{learning ? "Média /100" : "Faltas"}</span>
      </div>
      <IndicatorRows rows={rows} pending={pending} learning={learning} />
      {!pending && <IndicatorEmpty data={data} />}
      <IndicatorFooter data={data} learning={learning} onDetails={onDetails} />
    </section>
  );
}
function IndicatorRows({
  rows,
  pending,
  learning,
}: {
  rows: MetricClass[];
  pending: boolean;
  learning: boolean;
}): ReactElement {
  if (pending)
    return (
      <ul className={styles.rows}>
        {Array.from({ length: PREVIEW_CLASS_COUNT }, (_empty, index) => (
          <li key={index} className={styles.loading}>
            <InlineSkeleton className="w-3/5" />
            <InlineSkeleton className="w-8" />
          </li>
        ))}
      </ul>
    );
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <IndicatorRow key={row.id} row={row} learning={learning} />
      ))}
    </ul>
  );
}
function stageLabel(row: MetricClass): string {
  if (row.stages.length > 0) return row.stages.join(", ");
  return row.scheduleType === "PERSONALIZED" ? "Estágios individuais" : "Estágio não definido";
}
function indicatorValue(row: MetricClass, learning: boolean): string {
  if (learning) return row.grades === null ? "Sem notas" : metricNumber(row.grades);
  return row.attendance.percent === null
    ? "Sem chamada"
    : `${metricNumber(row.attendance.percent)}%`;
}
function IndicatorRow({ row, learning }: { row: MetricClass; learning: boolean }): ReactElement {
  const stage = stageLabel(row);
  const schedule = formatClassSchedule(row.schedule) || "Horário não definido";
  return (
    <li>
      <Link
        className={styles.row}
        href={`/turmas/${row.id}`}
        aria-label={`Abrir turma ${row.name}`}
      >
        <div className={styles.identity}>
          <span>
            <b title={row.name}>{row.name}</b>
            <span title={stage}>{stage}</span>
          </span>
          <small title={schedule}>{schedule}</small>
        </div>
        {!learning && (
          <span className={styles.calls} title="Chamadas confirmadas / aulas realizadas">
            {row.calls.confirmed}/{row.calls.due}
          </span>
        )}
        <strong
          className={styles.value}
          data-empty={(learning ? row.grades : row.attendance.percent) === null || undefined}
        >
          {indicatorValue(row, learning)}
        </strong>
      </Link>
    </li>
  );
}
function IndicatorEmpty({ data }: { data: Metrics | undefined }): ReactElement | null {
  if (!data) return <p className={styles.empty}>Indicadores indisponíveis.</p>;
  if (data.classes.length === 0)
    return <p className={styles.empty}>Nenhuma turma atual para acompanhar.</p>;
  return null;
}
function IndicatorFooter({
  data,
  learning,
  onDetails,
}: Pick<Props, "data" | "onDetails"> & { learning: boolean }): ReactElement {
  let evidence = "Faltas sem abatimento por reposições";
  if (learning)
    evidence = data
      ? `${data.assessedStudents} de ${data.studentCount} alunos avaliados`
      : "Notas no período de atuação";
  const action =
    data && data.classes.length > PREVIEW_CLASS_COUNT
      ? `Ver ${data.classes.length} turmas`
      : "Ver detalhes";
  return (
    <footer className={styles.footer}>
      <span>{evidence}</span>
      <Button
        variant="link"
        size="inline"
        disabled={!data}
        onClick={(event) => onDetails(event.currentTarget)}
      >
        {action}
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </footer>
  );
}

function IndicatorHeader({
  learning,
  pending,
  value,
}: {
  learning: boolean;
  pending: boolean;
  value: number | null | undefined;
}): ReactElement {
  const title = learning ? "Aprendizagem" : "Frequência";
  const Icon = learning ? BookOpen : CalendarCheck;
  return (
    <header className={styles.header}>
      <h2>
        <Icon aria-hidden="true" />
        {title}
      </h2>
      <div className={styles.summary}>
        {pending ? (
          <InlineSkeleton className="w-12" />
        ) : (
          <strong>
            {metricNumber(value)}
            {!learning && value !== null && value !== undefined && <small>%</small>}
          </strong>
        )}
        <span>{learning ? "média geral" : "de faltas"}</span>
      </div>
    </header>
  );
}
