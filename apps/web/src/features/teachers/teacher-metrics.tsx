"use client";
import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { ArrowRight, HeartPulse } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { TeacherClassIndicators } from "./teacher-class-indicators";
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
    <div className={styles.overview} data-expanded={query.isError || undefined}>
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
            label="score médio dos alunos"
          />
          <p>
            {data
              ? `${data.coveredStudents} de ${data.studentCount} alunos com dados`
              : "Média dos scores individuais, sem duplicar alunos"}
          </p>
          <TeacherHealthDistribution data={data} pending={pending} />
          <TeacherHealthContext data={data} />
          <MetricAction disabled={!data} onClick={onStudents}>
            Ver alunos por turma
          </MetricAction>
        </MetricContainer>
        <TeacherOccurrencePreview
          data={data}
          pending={pending}
          onDetails={(button) => open("followup", button)}
        />
        <TeacherClassIndicators
          kind="learning"
          data={data}
          pending={pending}
          onDetails={(button) => open("learning", button)}
        />
        <TeacherClassIndicators
          kind="attendance"
          data={data}
          pending={pending}
          onDetails={(button) => open("attendance", button)}
        />
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
          onClose={() => setDetail(null)}
          returnFocus={trigger}
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
function MetricAction({
  disabled,
  children,
  onClick,
}: {
  disabled: boolean;
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
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
