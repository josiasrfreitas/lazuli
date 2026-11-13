import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarCheck } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { formatClassSchedule } from "~/features/classes/labels";
import { metricNumber } from "./teacher-metric-details";
import styles from "./teacher-class-indicators.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];

export function TeacherClassIndicators({
  kind,
  data,
  pending,
  onDetails,
}: {
  kind: "learning" | "attendance";
  data: Metrics | undefined;
  pending: boolean;
  onDetails: (button: HTMLButtonElement) => void;
}): ReactElement {
  const learning = kind === "learning";
  const title = learning ? "Aprendizagem" : "Frequência";
  const Icon = learning ? BookOpen : CalendarCheck;
  const rows = data?.classes.slice(0, 4) ?? [];
  const value = learning ? data?.grades : data?.attendance.percent;
  return (
    <section className={styles.card} aria-label={title} aria-busy={pending}>
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
              {!learning && value != null && <small>%</small>}
            </strong>
          )}
          <span>{learning ? "média geral" : "de faltas"}</span>
        </div>
      </header>
      <div className={styles.columns}>
        <span>Turma · estágio e horário</span>
        {!learning && <span>Chamadas</span>}
        <span>{learning ? "Média /100" : "Faltas"}</span>
      </div>
      <ul className={styles.rows}>
        {pending
          ? Array.from({ length: 4 }, (_, index) => (
              <li key={index} className={styles.loading}>
                <InlineSkeleton className="w-3/5" />
                <InlineSkeleton className="w-8" />
              </li>
            ))
          : rows.map((row) => {
              const stage = row.stages.length
                ? row.stages.join(", ")
                : row.scheduleType === "PERSONALIZED"
                  ? "Estágios individuais"
                  : "Estágio não definido";
              const schedule = formatClassSchedule(row.schedule) || "Horário não definido";
              return (
                <li key={row.id}>
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
                      <span
                        className={styles.calls}
                        title="Chamadas confirmadas / aulas realizadas"
                      >
                        {row.calls.confirmed}/{row.calls.due}
                      </span>
                    )}
                    <strong
                      className={styles.value}
                      data-empty={
                        (learning ? row.grades : row.attendance.percent) === null || undefined
                      }
                    >
                      {learning
                        ? row.grades === null
                          ? "Sem notas"
                          : metricNumber(row.grades)
                        : row.attendance.percent === null
                          ? "Sem chamada"
                          : `${metricNumber(row.attendance.percent)}%`}
                    </strong>
                  </Link>
                </li>
              );
            })}
      </ul>
      {!pending && data && rows.length === 0 && (
        <p className={styles.empty}>Nenhuma turma atual para acompanhar.</p>
      )}
      {!pending && !data && <p className={styles.empty}>Indicadores indisponíveis.</p>}
      <footer className={styles.footer}>
        <span>
          {learning
            ? data
              ? `${data.assessedStudents} de ${data.studentCount} alunos avaliados`
              : "Notas no período de atuação"
            : "Faltas sem abatimento por reposições"}
        </span>
        <Button
          variant="link"
          size="inline"
          disabled={!data}
          onClick={(event) => onDetails(event.currentTarget)}
        >
          {data && data.classes.length > 4 ? `Ver ${data.classes.length} turmas` : "Ver detalhes"}
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </footer>
    </section>
  );
}
