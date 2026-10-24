import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Users,
  GraduationCap,
  CalendarCheck2,
} from "lucide-react";
import { Badge } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { monthLabel } from "~/features/finance-analytics/contract-closings-model";
import type { HomeData } from "./home-parts";
import styles from "./home.module.css";

export type BusinessData = RouterOutputs["dashboard"]["business"];
type Series = { month: string; value: number }[];
export function Trend({
  current,
  previous,
  partial,
}: {
  current: number;
  previous: number;
  partial: boolean;
}): ReactElement {
  const change = previous === 0 ? null : ((current - previous) / previous) * 100;
  const direction = current === previous ? "flat" : current > previous ? "up" : "down";
  const Icon = direction === "flat" ? Minus : direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={styles.trend}>
      <Badge
        variant={
          direction === "up" && previous > 0
            ? "success"
            : direction === "down"
              ? "warning"
              : "neutral"
        }
      >
        <Icon aria-hidden="true" />
        {change === null
          ? previous === current
            ? "Sem variação"
            : "Sem base anterior"
          : `${change > 0 ? "+" : ""}${change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
      </Badge>
      <span>{partial ? "vs. mesmos dias do mês anterior" : "vs. mês anterior"}</span>
    </div>
  );
}
export function Sparkline({ series, label }: { series: Series; label: string }): ReactElement {
  const max = Math.max(1, ...series.map((point) => point.value));
  const min = Math.min(0, ...series.map((point) => point.value));
  const points = series
    .map(
      (point, index) =>
        `${4 + (index / Math.max(1, series.length - 1)) * 152},${42 - ((point.value - min) / (max - min)) * 34}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 160 48" className={styles.sparkline} role="img" aria-label={label}>
      <title>
        {series
          .map((point) => `${monthLabel(point.month)}: ${point.value.toLocaleString("pt-BR")}`)
          .join("; ")}
      </title>
      <path d="M4 43H156" className={styles.sparkBaseline} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {series.length > 0 && (
        <circle
          cx="156"
          cy={42 - ((series[series.length - 1]!.value - min) / (max - min)) * 34}
          r="3"
          fill="currentColor"
        />
      )}
    </svg>
  );
}
function Metric({
  label,
  value,
  context,
  href,
  icon,
  variant,
  children,
}: {
  label: string;
  value: string;
  context: string;
  href: string;
  icon: ReactNode;
  variant?: "lead" | "attention";
  children: ReactNode;
}): ReactElement {
  return (
    <article className={styles.metric} data-variant={variant}>
      <div className={styles.metricHeading}>
        <h2>
          {icon}
          {label}
        </h2>
        <Link href={href} aria-label={`Abrir detalhes de ${label}`}>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.metricValue}>{value}</div>
      <p className={styles.metricContext}>{context}</p>
      {children}
    </article>
  );
}
export function SchoolMetrics({ data }: { data: HomeData }): ReactElement {
  const school = data.school;
  const metrics = [
    {
      label: "Matrículas iniciadas",
      metric: school.enrollments,
      context: "Entradas em turmas, incluindo transferências",
      href: "/organizacao",
      icon: <GraduationCap aria-hidden="true" />,
    },
    {
      label: "Novos alunos",
      metric: school.students,
      context: "Cadastros de alunos no período",
      href: "/alunos",
      icon: <Users aria-hidden="true" />,
    },
    {
      label: "Experimentais realizadas",
      metric: school.trials,
      context: "Aulas experimentais com presença registrada",
      href: "/interessados",
      icon: <CalendarCheck2 aria-hidden="true" />,
    },
  ];
  return (
    <div className={styles.metrics} aria-label="Indicadores da escola">
      {metrics.map((item, index) => (
        <Metric
          key={item.label}
          label={item.label}
          value={item.metric.value.toLocaleString("pt-BR")}
          context={item.context}
          href={item.href}
          icon={item.icon}
          {...(index === 0 ? { variant: "lead" as const } : {})}
        >
          <div className={styles.metricBottom}>
            <Trend
              current={item.metric.value}
              previous={item.metric.previous}
              partial={school.partial}
            />
            <Sparkline series={item.metric.series} label={`${item.label} nos últimos seis meses`} />
          </div>
        </Metric>
      ))}
    </div>
  );
}
