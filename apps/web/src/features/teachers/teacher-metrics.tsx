"use client";
import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { ArrowDown, ArrowRight, BookOpen, HeartPulse, CalendarCheck } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { TeacherOccurrencesDialog } from "./teacher-occurrences-dialog";
import { TeacherOccurrencePreview } from "./teacher-occurrence-preview";
import { TeacherHealthInfo } from "./teacher-health-info";
import { TeacherHealthContext } from "./teacher-health-context";
import { TeacherHealthDistribution } from "./teacher-health-distribution";
import { trpc } from "~/lib/trpc";
import { TeacherMetricDetails, type MetricDetail, metricNumber } from "./teacher-metric-details";
import styles from "./teacher-overview.module.css";

export function TeacherMetrics({
  id,
  onStudents,
}: {
  id: string;
  onStudents: () => void;
}): ReactElement {
  const query = trpc.teachers.metrics.useQuery(
    { id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const [detail, setDetail] = useState<MetricDetail | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const data = query.data;
  const pending = !data && !query.isError;
  const open = (next: MetricDetail, button: HTMLButtonElement): void => {
    trigger.current = button;
    setDetail(next);
  };
  return (
    <div
      className={styles.overview}
      data-expanded={Boolean((detail && detail !== "followup") || query.isError) || undefined}
    >
      {query.isError && (
        <div role="alert" className={styles.error}>
          <p>Não foi possível atualizar os indicadores.</p>
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      <div className={styles.overviewGrid} aria-busy={pending} data-loading={pending || undefined}>
        <MetricContainer
          title="Saúde dos alunos"
          icon={<HeartPulse />}
          health
          info={<TeacherHealthInfo data={data} />}
        >
          <MetricReading
            pending={pending}
            value={metricNumber(data?.score)}
            suffix="pontos"
            label="score médio dos alunos"
          />
          <p>
            {data
              ? `${data.coveredStudents} de ${data.studentCount} alunos com dados`
              : "Média dos scores individuais, sem duplicar alunos"}
          </p>
          <TeacherHealthDistribution data={data} pending={pending} />
          <TeacherHealthContext data={data} />
          <MetricAction disabled={!data} onClick={onStudents} navigate>
            Ver alunos por turma
          </MetricAction>
        </MetricContainer>
        <TeacherOccurrencePreview
          data={data}
          pending={pending}
          onDetails={(button) => open("followup", button)}
        />
        <MetricContainer title="Aprendizagem" icon={<BookOpen />} compact>
          <MetricReading
            pending={pending}
            value={metricNumber(data?.grades)}
            suffix="/100"
            label="média das notas por aluno"
          />
          <p>
            {data
              ? `${data.assessedStudents} de ${data.studentCount} alunos avaliados · ${data.gradeCount} notas`
              : "Notas dos alunos nas turmas atuais"}
          </p>
          <div className={styles.previewRows}>
            {pending ? (
              <MetricLines />
            ) : (
              data?.books
                .filter((row) => row.average !== null)
                .slice(0, 2)
                .map((row) => (
                  <div key={row.id}>
                    <span title={row.name}>{row.name}</span>
                    <strong>{metricNumber(row.average)}</strong>
                  </div>
                ))
            )}
            {data && data.gradeCount === 0 && <span>Nenhuma nota no período de atuação.</span>}
          </div>
          <MetricAction disabled={!data} onClick={(button) => open("learning", button)}>
            Ver notas por livro, turma e aluno
          </MetricAction>
        </MetricContainer>
        <MetricContainer title="Frequência" icon={<CalendarCheck />} compact>
          <MetricReading
            pending={pending}
            value={metricNumber(data?.attendance.percent)}
            suffix="%"
            label="de faltas dos alunos"
          />
          <p>Aulas realizadas no período de atuação, sem abatimento por reposições.</p>
          <dl className={styles.facts}>
            <div>
              <dt>Chamadas das turmas</dt>
              <dd>
                {pending ? (
                  <InlineSkeleton className="w-12" />
                ) : data ? (
                  `${data.calls.confirmed} de ${data.calls.due}`
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <MetricAction disabled={!data} onClick={(button) => open("attendance", button)}>
            Ver frequência por turma e aluno
          </MetricAction>
        </MetricContainer>
      </div>
      {detail === "followup" && data && (
        <TeacherOccurrencesDialog
          data={data}
          onClose={() => setDetail(null)}
          returnFocus={trigger}
        />
      )}
      {detail && detail !== "followup" && data && (
        <TeacherMetricDetails
          key={detail}
          data={data}
          detail={detail}
          onClose={() => {
            setDetail(null);
            trigger.current?.focus();
          }}
        />
      )}
    </div>
  );
}
function MetricContainer({
  title,
  icon,
  health,
  compact,
  attention,
  info,
  children,
}: {
  title: string;
  icon: ReactNode;
  health?: boolean;
  compact?: boolean;
  attention?: boolean;
  info?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      className={styles.metricCard}
      data-health={health || undefined}
      data-compact={compact || undefined}
      data-attention={attention || undefined}
      aria-label={title}
    >
      <div className={styles.cardHeading}>
        <h2>
          {icon}
          {title}
        </h2>
        {info}
      </div>
      {children}
    </section>
  );
}
function MetricReading({
  pending,
  value,
  suffix,
  label,
}: {
  pending: boolean;
  value: string;
  suffix?: string;
  label: string;
}): ReactElement {
  return (
    <div className={styles.reading}>
      <strong>
        {pending ? <InlineSkeleton shape="block" className="h-8 w-20" /> : value}
        <small>{suffix}</small>
      </strong>
      <span>{label}</span>
    </div>
  );
}
function MetricLines(): ReactElement {
  return (
    <>
      <InlineSkeleton className="w-full" />
      <InlineSkeleton className="w-4/5" />
    </>
  );
}
function MetricAction({
  disabled,
  children,
  onClick,
  navigate,
}: {
  disabled: boolean;
  navigate?: boolean;
  children: ReactNode;
  onClick: (button: HTMLButtonElement) => void;
}): ReactElement {
  return (
    <div className={styles.cardAction}>
      <Button
        variant="link"
        size="sm"
        disabled={disabled}
        onClick={(event) => onClick(event.currentTarget)}
      >
        {children}
        {navigate ? <ArrowRight aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
      </Button>
    </div>
  );
}
